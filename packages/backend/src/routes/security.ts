import { Router, Request, Response } from 'express';
import db from '../db/connection.js';
import { blockIP, unblockIP } from '../services/crowdsec.js';
import { validate } from '../middleware/validate.js';
import { blockIPSchema, unblockIPSchema } from '../validation/schemas.js';
import { asyncHandler } from '../middleware/async-handler.js';

const router = Router();

// GET /api/security/overview
router.get('/overview', (_req: Request, res: Response) => {
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  const totalAlerts24h = (db.prepare('SELECT COUNT(*) as count FROM security_alerts WHERE collected_at > ?').get(oneDayAgo) as { count: number }).count;
  const activeDecisions = (db.prepare('SELECT COUNT(*) as count FROM security_decisions').get() as { count: number }).count;

  const topScenarios = db.prepare(`
    SELECT scenario, COUNT(*) as count
    FROM security_alerts WHERE collected_at > ?
    GROUP BY scenario ORDER BY count DESC LIMIT 5
  `).all(oneDayAgo);

  const topCountries = db.prepare(`
    SELECT source_country, COUNT(*) as count
    FROM security_alerts WHERE collected_at > ? AND source_country != ''
    GROUP BY source_country ORDER BY count DESC LIMIT 5
  `).all(oneDayAgo);

  const alertsPerHour = db.prepare(`
    SELECT (collected_at / 3600000) * 3600000 as hour, COUNT(*) as count
    FROM security_alerts WHERE collected_at > ?
    GROUP BY hour ORDER BY hour ASC
  `).all(oneDayAgo);

  res.json({
    total_alerts_24h: totalAlerts24h,
    active_decisions: activeDecisions,
    top_scenarios: topScenarios,
    top_countries: topCountries,
    alerts_per_hour: alertsPerHour,
  });
});

// GET /api/security/alerts
router.get('/alerts', (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;
  const host_id = req.query.host_id as string | undefined;

  let where = 'WHERE 1=1';
  const params: unknown[] = [];
  if (host_id) { where += ' AND a.host_id = ?'; params.push(host_id); }

  const total = (db.prepare(`SELECT COUNT(*) as count FROM security_alerts a ${where}`).get(...params) as { count: number }).count;
  const alerts = db.prepare(`
    SELECT a.*, h.name as host_name
    FROM security_alerts a LEFT JOIN hosts h ON a.host_id = h.id
    ${where} ORDER BY a.collected_at DESC LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({ alerts, total, limit, offset });
});

// GET /api/security/decisions
router.get('/decisions', (req: Request, res: Response) => {
  const host_id = req.query.host_id as string | undefined;

  let where = 'WHERE 1=1';
  const params: unknown[] = [];
  if (host_id) { where += ' AND d.host_id = ?'; params.push(host_id); }

  const decisions = db.prepare(`
    SELECT d.*, h.name as host_name
    FROM security_decisions d LEFT JOIN hosts h ON d.host_id = h.id
    ${where} ORDER BY d.created_at DESC
  `).all(...params);

  res.json(decisions);
});

// POST /api/security/block
router.post('/block', validate(blockIPSchema), asyncHandler(async (req: Request, res: Response) => {
  const { host_id, ip, duration, reason } = req.body;

  const result = await blockIP(host_id, ip, duration || '24h', reason || 'manual block');
  res.json(result);
}));

// POST /api/security/unblock
router.post('/unblock', validate(unblockIPSchema), asyncHandler(async (req: Request, res: Response) => {
  const { host_id, ip } = req.body;

  const result = await unblockIP(host_id, ip);
  res.json(result);
}));

export default router;
