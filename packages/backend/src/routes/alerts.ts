import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import db from '../db/connection.js';
import { notify } from '../services/notifier.js';
import { validate } from '../middleware/validate.js';
import { createChannelSchema, updateChannelSchema, createRuleSchema, updateRuleSchema } from '../validation/schemas.js';
import { NotFoundError } from '../errors.js';
import { asyncHandler } from '../middleware/async-handler.js';

const router = Router();

// --- Notification Channels ---

// GET /api/alerts/channels
router.get('/channels', (_req: Request, res: Response) => {
  const channels = db.prepare('SELECT * FROM notification_channels ORDER BY created_at DESC').all();
  res.json(channels);
});

// POST /api/alerts/channels
router.post('/channels', validate(createChannelSchema), (req: Request, res: Response) => {
  const { name, type, config: channelConfig } = req.body;

  const id = randomUUID();
  const now = Date.now();
  const configStr = typeof channelConfig === 'string' ? channelConfig : JSON.stringify(channelConfig);

  db.prepare('INSERT INTO notification_channels (id, name, type, config, enabled, created_at) VALUES (?, ?, ?, ?, 1, ?)')
    .run(id, name, type, configStr, now);

  const channel = db.prepare('SELECT * FROM notification_channels WHERE id = ?').get(id);
  res.status(201).json(channel);
});

// PATCH /api/alerts/channels/:id
router.patch('/channels/:id', validate(updateChannelSchema), (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM notification_channels WHERE id = ?').get(id);
  if (!existing) throw new NotFoundError('Channel');

  const { name, type, config: channelConfig, enabled } = req.body;
  const updates: string[] = [];
  const params: unknown[] = [];

  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (type !== undefined) { updates.push('type = ?'); params.push(type); }
  if (channelConfig !== undefined) {
    const configStr = typeof channelConfig === 'string' ? channelConfig : JSON.stringify(channelConfig);
    updates.push('config = ?');
    params.push(configStr);
  }
  if (enabled !== undefined) { updates.push('enabled = ?'); params.push(enabled ? 1 : 0); }

  if (updates.length > 0) {
    params.push(id);
    db.prepare(`UPDATE notification_channels SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  const channel = db.prepare('SELECT * FROM notification_channels WHERE id = ?').get(id);
  res.json(channel);
});

// DELETE /api/alerts/channels/:id
router.delete('/channels/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM notification_channels WHERE id = ?').run(id);
  if (result.changes === 0) throw new NotFoundError('Channel');
  res.json({ success: true });
});

// POST /api/alerts/channels/:id/test
router.post('/channels/:id/test', asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const success = await notify(id, 'ShipIt test notification - alerting is working!');
  res.json({ success });
}));

// --- Alert Rules ---

// GET /api/alerts/rules
router.get('/rules', (_req: Request, res: Response) => {
  const rules = db.prepare('SELECT * FROM alert_rules ORDER BY created_at DESC').all();
  res.json(rules);
});

// POST /api/alerts/rules
router.post('/rules', validate(createRuleSchema), (req: Request, res: Response) => {
  const { name, type, condition, channel_ids, cooldown } = req.body;

  const id = randomUUID();
  const now = Date.now();
  const condStr = typeof condition === 'string' ? condition : JSON.stringify(condition);
  const chStr = typeof channel_ids === 'string' ? channel_ids : JSON.stringify(channel_ids);

  db.prepare('INSERT INTO alert_rules (id, name, type, condition, channel_ids, cooldown, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)')
    .run(id, name, type, condStr, chStr, cooldown ?? 300, now);

  const rule = db.prepare('SELECT * FROM alert_rules WHERE id = ?').get(id);
  res.status(201).json(rule);
});

// PATCH /api/alerts/rules/:id
router.patch('/rules/:id', validate(updateRuleSchema), (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM alert_rules WHERE id = ?').get(id);
  if (!existing) throw new NotFoundError('Rule');

  const { name, type, condition, channel_ids, cooldown, enabled } = req.body;
  const updates: string[] = [];
  const params: unknown[] = [];

  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (type !== undefined) { updates.push('type = ?'); params.push(type); }
  if (condition !== undefined) {
    const condStr = typeof condition === 'string' ? condition : JSON.stringify(condition);
    updates.push('condition = ?');
    params.push(condStr);
  }
  if (channel_ids !== undefined) {
    const chStr = typeof channel_ids === 'string' ? channel_ids : JSON.stringify(channel_ids);
    updates.push('channel_ids = ?');
    params.push(chStr);
  }
  if (cooldown !== undefined) { updates.push('cooldown = ?'); params.push(cooldown); }
  if (enabled !== undefined) { updates.push('enabled = ?'); params.push(enabled ? 1 : 0); }

  if (updates.length > 0) {
    params.push(id);
    db.prepare(`UPDATE alert_rules SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  const rule = db.prepare('SELECT * FROM alert_rules WHERE id = ?').get(id);
  res.json(rule);
});

// DELETE /api/alerts/rules/:id
router.delete('/rules/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM alert_rules WHERE id = ?').run(id);
  if (result.changes === 0) throw new NotFoundError('Rule');
  res.json({ success: true });
});

// --- Alert History ---

// GET /api/alerts/history
router.get('/history', (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;

  const total = (db.prepare('SELECT COUNT(*) as count FROM alert_history').get() as { count: number }).count;
  const history = db.prepare('SELECT * FROM alert_history ORDER BY triggered_at DESC LIMIT ? OFFSET ?').all(limit, offset);

  res.json({ history, total, limit, offset });
});

export default router;
