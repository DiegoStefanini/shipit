import { Router, Request, Response } from 'express';
import db from '../db/connection.js';

const router = Router();

// GET /api/monitoring/overview — latest metrics for all hosts
router.get('/overview', (_req: Request, res: Response) => {
  // For each host, get the latest metrics (most recent collected_at per metric_name)
  const hosts = db.prepare('SELECT * FROM hosts ORDER BY name').all() as Record<string, unknown>[];

  const overview = hosts.map(host => {
    const hostId = host.id as string;
    // Get latest system metrics
    const latestMetrics = db.prepare(`
      SELECT metric_name, metric_value, unit, collected_at
      FROM metrics
      WHERE host_id = ? AND source = 'proxmox'
      AND collected_at = (SELECT MAX(collected_at) FROM metrics WHERE host_id = ? AND source = 'proxmox')
    `).all(hostId, hostId) as Record<string, unknown>[];

    const metricsMap: Record<string, number> = {};
    for (const m of latestMetrics) {
      metricsMap[m.metric_name as string] = m.metric_value as number;
    }

    return {
      host_id: hostId,
      host_name: host.name,
      host_type: host.type,
      status: host.status,
      last_seen_at: host.last_seen_at,
      metrics: metricsMap,
    };
  });

  res.json(overview);
});

// GET /api/monitoring/hosts/:id — time series metrics for a host
router.get('/hosts/:id', (req: Request, res: Response) => {
  const hostId = req.params.id;
  const from = parseInt(req.query.from as string) || (Date.now() - 3600_000); // default 1h
  const to = parseInt(req.query.to as string) || Date.now();

  const host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(hostId);
  if (!host) {
    res.status(404).json({ error: 'Host not found' });
    return;
  }

  const metrics = db.prepare(`
    SELECT metric_name, metric_value, collected_at
    FROM metrics
    WHERE host_id = ? AND source = 'proxmox' AND collected_at BETWEEN ? AND ?
    ORDER BY collected_at ASC
  `).all(hostId, from, to) as Record<string, unknown>[];

  // Group by metric_name into time series
  const series: Record<string, Array<{ t: number; v: number }>> = {};
  for (const m of metrics) {
    const name = m.metric_name as string;
    if (!series[name]) series[name] = [];
    series[name].push({ t: m.collected_at as number, v: m.metric_value as number });
  }

  res.json({ host_id: hostId, from, to, series });
});

// GET /api/monitoring/hosts/:id/containers — Docker container metrics
router.get('/hosts/:id/containers', (req: Request, res: Response) => {
  const hostId = req.params.id;

  const host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(hostId);
  if (!host) {
    res.status(404).json({ error: 'Host not found' });
    return;
  }

  // Get latest container metrics
  const latest = db.prepare(`
    SELECT container_name, metric_name, metric_value, collected_at
    FROM metrics
    WHERE host_id = ? AND source = 'docker'
    AND collected_at = (SELECT MAX(collected_at) FROM metrics WHERE host_id = ? AND source = 'docker')
    ORDER BY container_name
  `).all(hostId, hostId) as Record<string, unknown>[];

  // Group by container
  const containers: Record<string, Record<string, number>> = {};
  for (const m of latest) {
    const name = m.container_name as string;
    if (!containers[name]) containers[name] = {};
    containers[name][m.metric_name as string] = m.metric_value as number;
  }

  res.json({ host_id: hostId, containers });
});

export default router;
