import { Router, Request, Response } from 'express';
import db from '../db/connection.js';
import * as ssh from '../services/ssh.js';
import * as proxmox from '../services/proxmox.js';
import { validate } from '../middleware/validate.js';
import { createHostSchema, updateHostSchema } from '../validation/schemas.js';

const router = Router();

function paramId(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

// GET /api/hosts
router.get('/', (_req: Request, res: Response) => {
  const hosts = db.prepare('SELECT * FROM hosts ORDER BY created_at DESC').all();
  res.json(hosts);
});

// POST /api/hosts
router.post('/', validate(createHostSchema), (req: Request, res: Response) => {
  const { name, type, proxmox_vmid, ip_address, ssh_port, ssh_user, ssh_key_path, has_docker, has_crowdsec } = req.body;

  const id = crypto.randomUUID();
  const now = Date.now();

  try {
    db.prepare(
      `INSERT INTO hosts (id, name, type, proxmox_vmid, ip_address, ssh_port, ssh_user, ssh_key_path, has_docker, has_crowdsec, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      name,
      type ?? 'vm',
      proxmox_vmid ?? null,
      ip_address,
      ssh_port ?? 22,
      ssh_user ?? 'root',
      ssh_key_path ?? null,
      has_docker ? 1 : 0,
      has_crowdsec ? 1 : 0,
      now,
      now,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('UNIQUE')) {
      res.status(409).json({ error: 'Host name already exists' });
      return;
    }
    throw err;
  }

  const host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(id);
  res.status(201).json(host);
});

// GET /api/hosts/:id
router.get('/:id', (req: Request, res: Response) => {
  const host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(paramId(req));
  if (!host) {
    res.status(404).json({ error: 'Host not found' });
    return;
  }
  res.json(host);
});

// PATCH /api/hosts/:id
router.patch('/:id', validate(updateHostSchema), (req: Request, res: Response) => {
  const host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(paramId(req));
  if (!host) {
    res.status(404).json({ error: 'Host not found' });
    return;
  }

  const allowedFields = ['name', 'type', 'proxmox_vmid', 'ip_address', 'ssh_port', 'ssh_user', 'ssh_key_path', 'has_docker', 'has_crowdsec', 'poll_interval'];
  const updates: string[] = [];
  const values: unknown[] = [];

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      if (field === 'has_docker' || field === 'has_crowdsec') {
        updates.push(`${field} = ?`);
        values.push(req.body[field] ? 1 : 0);
      } else {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }
  }

  if (updates.length === 0) {
    res.json(host);
    return;
  }

  updates.push('updated_at = ?');
  values.push(Date.now());
  values.push(paramId(req));

  try {
    db.prepare(`UPDATE hosts SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('UNIQUE')) {
      res.status(409).json({ error: 'Host name already exists' });
      return;
    }
    throw err;
  }

  const updated = db.prepare('SELECT * FROM hosts WHERE id = ?').get(paramId(req));
  res.json(updated);
});

// DELETE /api/hosts/:id
router.delete('/:id', (req: Request, res: Response) => {
  const host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(paramId(req));
  if (!host) {
    res.status(404).json({ error: 'Host not found' });
    return;
  }

  ssh.disconnect(paramId(req));
  db.prepare('DELETE FROM hosts WHERE id = ?').run(paramId(req));
  res.status(204).end();
});

// POST /api/hosts/:id/test
router.post('/:id/test', async (req: Request, res: Response) => {
  const host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(paramId(req));
  if (!host) {
    res.status(404).json({ error: 'Host not found' });
    return;
  }

  const result = await ssh.testConnection(paramId(req));

  if (result.success) {
    db.prepare('UPDATE hosts SET status = ?, last_seen_at = ?, updated_at = ? WHERE id = ?')
      .run('online', Date.now(), Date.now(), paramId(req));
  } else {
    db.prepare('UPDATE hosts SET status = ?, updated_at = ? WHERE id = ?')
      .run('offline', Date.now(), paramId(req));
  }

  res.json(result);
});

// GET /api/hosts/:id/status
router.get('/:id/status', async (req: Request, res: Response) => {
  const host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(paramId(req)) as Record<string, unknown> | undefined;
  if (!host) {
    res.status(404).json({ error: 'Host not found' });
    return;
  }

  if (!host.proxmox_vmid) {
    res.status(400).json({ error: 'Host has no Proxmox VMID configured' });
    return;
  }

  try {
    const nodes = await proxmox.getNodes();
    if (nodes.length === 0) {
      res.status(500).json({ error: 'No Proxmox nodes available' });
      return;
    }

    const type = (host.type as string) === 'ct' ? 'ct' : 'vm';
    const status = await proxmox.getVMStatus(nodes[0].node, host.proxmox_vmid as number, type);
    res.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
