import { Router, Request, Response } from 'express';
import db from '../db/connection.js';
import { enqueueBuild } from '../engine/builder.js';
import { stopAndRemove } from '../engine/docker.js';

const router = Router();

const NAME_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

function paramId(req: Request): string {
  const id = paramId(req);
  return Array.isArray(id) ? id[0] : id;
}

// GET /api/projects
router.get('/', (_req: Request, res: Response) => {
  const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
  res.json(projects);
});

// POST /api/projects
router.post('/', (req: Request, res: Response) => {
  const { name, gitea_repo, gitea_url, branch } = req.body;

  if (!name || !gitea_repo || !gitea_url) {
    res.status(400).json({ error: 'name, gitea_repo, and gitea_url are required' });
    return;
  }

  if (!NAME_REGEX.test(name)) {
    res.status(400).json({ error: 'name must be lowercase alphanumeric with hyphens only' });
    return;
  }

  const id = crypto.randomUUID();
  const now = Date.now();

  try {
    db.prepare(
      `INSERT INTO projects (id, name, gitea_repo, gitea_url, branch, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, name, gitea_repo, gitea_url, branch ?? 'main', now, now);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('UNIQUE')) {
      res.status(409).json({ error: 'Project name already exists' });
      return;
    }
    throw err;
  }

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  res.status(201).json(project);
});

// GET /api/projects/:id
router.get('/:id', (req: Request, res: Response) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(paramId(req));
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  res.json(project);
});

// PATCH /api/projects/:id
router.patch('/:id', (req: Request, res: Response) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(paramId(req)) as Record<string, unknown> | undefined;
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const { name, branch, env_vars } = req.body;
  const updates: string[] = [];
  const values: unknown[] = [];

  if (name !== undefined) {
    if (!NAME_REGEX.test(name)) {
      res.status(400).json({ error: 'name must be lowercase alphanumeric with hyphens only' });
      return;
    }
    updates.push('name = ?');
    values.push(name);
  }
  if (branch !== undefined) {
    updates.push('branch = ?');
    values.push(branch);
  }
  if (env_vars !== undefined) {
    updates.push('env_vars = ?');
    values.push(typeof env_vars === 'string' ? env_vars : JSON.stringify(env_vars));
  }

  if (updates.length === 0) {
    res.json(project);
    return;
  }

  updates.push('updated_at = ?');
  values.push(Date.now());
  values.push(paramId(req));

  db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(paramId(req));
  res.json(updated);
});

// DELETE /api/projects/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(paramId(req)) as Record<string, unknown> | undefined;
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  // Stop container if running
  if (project.container_id) {
    try {
      await stopAndRemove(project.container_id as string);
    } catch {
      // Ignore
    }
  }

  db.prepare('DELETE FROM projects WHERE id = ?').run(paramId(req));
  res.status(204).end();
});

// POST /api/projects/:id/deploy
router.post('/:id/deploy', (req: Request, res: Response) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(paramId(req));
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  enqueueBuild(paramId(req));
  res.json({ message: 'Deploy queued' });
});

// GET /api/projects/:id/deploys
router.get('/:id/deploys', (req: Request, res: Response) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(paramId(req));
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const deploys = db.prepare(
    'SELECT * FROM deploys WHERE project_id = ? ORDER BY started_at DESC',
  ).all(paramId(req));
  res.json(deploys);
});

export default router;
