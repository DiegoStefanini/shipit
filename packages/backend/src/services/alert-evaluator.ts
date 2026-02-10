import db from '../db/connection.js';
import { notify } from './notifier.js';
import { logger } from '../logger.js';

let evaluatorInterval: ReturnType<typeof setInterval> | null = null;

interface AlertRule {
  id: string;
  name: string;
  type: string;
  condition: string;
  channel_ids: string;
  cooldown: number;
  enabled: number;
  last_triggered_at: number | null;
  created_at: number;
}

interface ConditionMetricThreshold {
  host_id?: string;
  metric_name: string;
  operator: '>' | '<' | '>=' | '<=';
  value: number;
}

interface ConditionServiceDown {
  host_id?: string;
}

interface ConditionSecurity {
  min_count?: number;
  window_minutes?: number;
}

interface ConditionDeploy {
  project_id?: string;
}

export function startAlertEvaluator(): void {
  evaluateRules();
  evaluatorInterval = setInterval(evaluateRules, 60_000);
}

export function stopAlertEvaluator(): void {
  if (evaluatorInterval) clearInterval(evaluatorInterval);
}

async function evaluateRules(): Promise<void> {
  const rules = db.prepare('SELECT * FROM alert_rules WHERE enabled = 1').all() as AlertRule[];
  const now = Date.now();

  for (const rule of rules) {
    // Cooldown check
    if (rule.last_triggered_at && now - rule.last_triggered_at < rule.cooldown * 1000) {
      continue;
    }

    try {
      const message = evaluateRule(rule, now);
      if (message) {
        await triggerAlert(rule, message, now);
      }
    } catch (err) {
      logger.error({ err, rule: rule.name }, 'Alert rule evaluation failed');
    }
  }
}

function evaluateRule(rule: AlertRule, now: number): string | null {
  const condition = JSON.parse(rule.condition);

  switch (rule.type) {
    case 'metric_threshold':
      return evaluateMetricThreshold(rule.name, condition as ConditionMetricThreshold, now);
    case 'service_down':
      return evaluateServiceDown(rule.name, condition as ConditionServiceDown);
    case 'security':
      return evaluateSecurity(rule.name, condition as ConditionSecurity, now);
    case 'deploy':
      return evaluateDeploy(rule.name, condition as ConditionDeploy);
    default:
      return null;
  }
}

function evaluateMetricThreshold(ruleName: string, cond: ConditionMetricThreshold, now: number): string | null {
  const fiveMinAgo = now - 5 * 60 * 1000;

  let query = `
    SELECT AVG(metric_value) as avg_value, host_id
    FROM metrics
    WHERE metric_name = ? AND collected_at > ?
  `;
  const params: unknown[] = [cond.metric_name, fiveMinAgo];

  if (cond.host_id) {
    query += ' AND host_id = ?';
    params.push(cond.host_id);
  }

  query += ' GROUP BY host_id';

  const rows = db.prepare(query).all(...params) as Array<{ avg_value: number; host_id: string }>;

  for (const row of rows) {
    const triggered = compareValue(row.avg_value, cond.operator, cond.value);
    if (triggered) {
      const hostRow = db.prepare('SELECT name FROM hosts WHERE id = ?').get(row.host_id) as { name: string } | undefined;
      const hostName = hostRow?.name ?? row.host_id;
      return `[${ruleName}] ${hostName}: ${cond.metric_name} = ${row.avg_value.toFixed(1)} (threshold: ${cond.operator} ${cond.value})`;
    }
  }

  return null;
}

function compareValue(actual: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case '>': return actual > threshold;
    case '<': return actual < threshold;
    case '>=': return actual >= threshold;
    case '<=': return actual <= threshold;
    default: return false;
  }
}

function evaluateServiceDown(ruleName: string, cond: ConditionServiceDown): string | null {
  let query = 'SELECT id, name, status FROM hosts WHERE status = ?';
  const params: unknown[] = ['offline'];

  if (cond.host_id) {
    query += ' AND id = ?';
    params.push(cond.host_id);
  }

  const offlineHosts = db.prepare(query).all(...params) as Array<{ id: string; name: string; status: string }>;

  if (offlineHosts.length > 0) {
    const names = offlineHosts.map(h => h.name).join(', ');
    return `[${ruleName}] Host(s) offline: ${names}`;
  }

  return null;
}

function evaluateSecurity(ruleName: string, cond: ConditionSecurity, now: number): string | null {
  const windowMs = (cond.window_minutes ?? 60) * 60 * 1000;
  const since = now - windowMs;
  const minCount = cond.min_count ?? 10;

  const row = db.prepare('SELECT COUNT(*) as count FROM security_alerts WHERE collected_at > ?').get(since) as { count: number };

  if (row.count >= minCount) {
    return `[${ruleName}] ${row.count} security alerts in the last ${cond.window_minutes ?? 60} minutes`;
  }

  return null;
}

function evaluateDeploy(ruleName: string, cond: ConditionDeploy): string | null {
  let query = `
    SELECT d.id, d.status, d.commit_msg, p.name as project_name
    FROM deploys d JOIN projects p ON d.project_id = p.id
    WHERE d.status = 'failed'
    AND d.finished_at > ?
  `;
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  const params: unknown[] = [fiveMinAgo];

  if (cond.project_id) {
    query += ' AND d.project_id = ?';
    params.push(cond.project_id);
  }

  query += ' ORDER BY d.finished_at DESC LIMIT 1';

  const row = db.prepare(query).get(...params) as { id: string; status: string; commit_msg: string; project_name: string } | undefined;

  if (row) {
    return `[${ruleName}] Deploy failed: ${row.project_name} - ${row.commit_msg ?? row.id}`;
  }

  return null;
}

async function triggerAlert(rule: AlertRule, message: string, now: number): Promise<void> {
  // Save to history
  db.prepare('INSERT INTO alert_history (rule_name, message, triggered_at) VALUES (?, ?, ?)').run(rule.name, message, now);

  // Update last_triggered_at
  db.prepare('UPDATE alert_rules SET last_triggered_at = ? WHERE id = ?').run(now, rule.id);

  // Notify all channels
  const channelIds: string[] = JSON.parse(rule.channel_ids);
  for (const channelId of channelIds) {
    await notify(channelId, message);
  }
}
