import db from '../db/connection.js';
import { exec } from './ssh.js';

let pollInterval: ReturnType<typeof setInterval> | null = null;

export function startCrowdSecCollector(): void {
  collectAll();
  pollInterval = setInterval(collectAll, 300_000); // Every 5 minutes
}

export function stopCrowdSecCollector(): void {
  if (pollInterval) clearInterval(pollInterval);
}

async function collectAll(): Promise<void> {
  const hosts = db.prepare('SELECT * FROM hosts WHERE has_crowdsec = 1').all() as Record<string, unknown>[];

  for (const host of hosts) {
    try {
      await collectAlerts(host);
      await collectDecisions(host);
    } catch (err) {
      console.error(`CrowdSec collection failed for ${host.name}:`, err);
    }
  }
}

async function collectAlerts(host: Record<string, unknown>): Promise<void> {
  const hostId = host.id as string;
  const now = Date.now();

  const result = await exec(hostId, 'cscli alerts list -o json --since 10m 2>/dev/null', 15_000);
  if (result.code !== 0 || !result.stdout.trim()) return;

  try {
    const alerts = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
    const insert = db.prepare(
      `INSERT OR IGNORE INTO security_alerts (host_id, alert_id, scenario, source_ip, source_country, source_as, events_count, start_at, stop_at, collected_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const alert of alerts) {
      const alertId = String(alert.id ?? '');
      const scenario = String(alert.scenario ?? 'unknown');
      const source = alert.source as Record<string, unknown> | undefined;
      const sourceIp = String(source?.ip ?? alert.source_ip ?? 'unknown');
      const sourceCountry = String(source?.cn ?? '');
      const sourceAs = String(source?.as_name ?? '');
      const eventsCount = (alert.events_count as number) ?? 1;
      const startAt = String(alert.start_at ?? '');
      const stopAt = String(alert.stop_at ?? '');

      insert.run(hostId, alertId, scenario, sourceIp, sourceCountry, sourceAs, eventsCount, startAt, stopAt, now);
    }
  } catch {
    // JSON parse failed
  }
}

async function collectDecisions(host: Record<string, unknown>): Promise<void> {
  const hostId = host.id as string;
  const now = Date.now();

  const result = await exec(hostId, 'cscli decisions list -o json 2>/dev/null', 15_000);
  if (result.code !== 0 || !result.stdout.trim()) return;

  try {
    const decisions = JSON.parse(result.stdout) as Array<Record<string, unknown>> | null;
    if (!decisions) return;

    db.prepare('DELETE FROM security_decisions WHERE host_id = ?').run(hostId);

    const insert = db.prepare(
      `INSERT INTO security_decisions (host_id, decision_id, source_ip, type, scenario, duration, origin, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const decision of decisions) {
      const decisionId = String(decision.id ?? '');
      const sourceIp = String(decision.value ?? 'unknown');
      const type = String(decision.type ?? 'ban');
      const scenario = String(decision.scenario ?? '');
      const duration = String(decision.duration ?? '');
      const origin = String(decision.origin ?? 'crowdsec');

      let expiresAt: number | null = null;
      if (duration) {
        const ms = parseDurationToMs(duration);
        if (ms > 0) expiresAt = now + ms;
      }

      insert.run(hostId, decisionId, sourceIp, type, scenario, duration, origin, now, expiresAt);
    }
  } catch {
    // JSON parse failed
  }
}

function parseDurationToMs(duration: string): number {
  let total = 0;
  const hours = duration.match(/(\d+)h/);
  const minutes = duration.match(/(\d+)m/);
  const seconds = duration.match(/(\d+)s/);
  if (hours) total += parseInt(hours[1]) * 3600_000;
  if (minutes) total += parseInt(minutes[1]) * 60_000;
  if (seconds) total += parseInt(seconds[1]) * 1000;
  return total;
}

export async function blockIP(hostId: string, ip: string, duration: string, reason: string): Promise<{ success: boolean; message: string }> {
  try {
    const result = await exec(hostId, `cscli decisions add --ip ${ip} --duration ${duration} --reason "${reason}" 2>&1`);
    return { success: result.code === 0, message: result.stdout.trim() || result.stderr.trim() };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : String(err) };
  }
}

export async function unblockIP(hostId: string, ip: string): Promise<{ success: boolean; message: string }> {
  try {
    const result = await exec(hostId, `cscli decisions delete --ip ${ip} 2>&1`);
    return { success: result.code === 0, message: result.stdout.trim() || result.stderr.trim() };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : String(err) };
  }
}
