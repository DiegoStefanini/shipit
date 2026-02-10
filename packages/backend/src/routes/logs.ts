import { Router, Request, Response } from 'express';
import db from '../db/connection.js';

const router = Router();

// GET /api/logs — search logs across all hosts
router.get('/', (req: Request, res: Response) => {
  const { host_id, source, level, container, service, q, from, to } = req.query;
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
  const offset = parseInt(req.query.offset as string) || 0;

  let where = 'WHERE 1=1';
  const params: unknown[] = [];

  if (host_id) { where += ' AND host_id = ?'; params.push(host_id); }
  if (source) { where += ' AND source = ?'; params.push(source); }
  if (level) { where += ' AND level = ?'; params.push(level); }
  if (container) { where += ' AND container_name = ?'; params.push(container); }
  if (service) { where += ' AND service_name = ?'; params.push(service); }
  if (q) { where += ' AND message LIKE ?'; params.push(`%${q}%`); }
  if (from) { where += ' AND timestamp >= ?'; params.push(parseInt(from as string)); }
  if (to) { where += ' AND timestamp <= ?'; params.push(parseInt(to as string)); }

  const total = (db.prepare(`SELECT COUNT(*) as count FROM logs ${where}`).get(...params) as { count: number }).count;

  const logs = db.prepare(
    `SELECT l.*, h.name as host_name FROM logs l LEFT JOIN hosts h ON l.host_id = h.id ${where} ORDER BY l.timestamp DESC LIMIT ? OFFSET ?`,
  ).all(...params, limit, offset);

  res.json({ logs, total, limit, offset });
});

// GET /api/logs/hosts/:id — logs for a specific host
router.get('/hosts/:id', (req: Request, res: Response) => {
  const hostId = req.params.id;
  const { source, level, q } = req.query;
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
  const offset = parseInt(req.query.offset as string) || 0;

  let where = 'WHERE host_id = ?';
  const params: unknown[] = [hostId];

  if (source) { where += ' AND source = ?'; params.push(source); }
  if (level) { where += ' AND level = ?'; params.push(level); }
  if (q) { where += ' AND message LIKE ?'; params.push(`%${q}%`); }

  const total = (db.prepare(`SELECT COUNT(*) as count FROM logs ${where}`).get(...params) as { count: number }).count;
  const logs = db.prepare(
    `SELECT * FROM logs ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
  ).all(...params, limit, offset);

  res.json({ logs, total, limit, offset });
});

export default router;
