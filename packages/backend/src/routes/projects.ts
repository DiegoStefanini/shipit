import { Router, Request, Response } from 'express';
import db from '../db/connection.js';
import { config } from '../config.js';
import { enqueueBuild } from '../engine/builder.js';
import { exec } from '../services/ssh.js';
import { validate } from '../middleware/validate.js';
import { createProjectSchema, updateProjectSchema } from '../validation/schemas.js';

async function createGiteaWebhook(giteaUrl: string, repo: string): Promise<void> {
  if (!config.giteaToken) return;
  const hookUrl = `https://${config.dashboardDomain}/api/webhooks/gitea`;
  try {
    await fetch(`${giteaUrl}/api/v1/repos/${repo}/hooks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `token ${config.giteaToken}`,
      },
      body: JSON.stringify({
        type: 'gitea',
        config: { url: hookUrl, content_type: 'json', secret: config.webhookSecret },
        events: ['push'],
        active: true,
      }),
    });
  } catch (err) {
    console.error('Failed to create Gitea webhook:', err);
  }
}

const router = Router();

const NAME_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

function paramId(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

// GET /api/projects
router.get('/', (_req: Request, res: Response) => {
  const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
  res.json(projects);
});

// POST /api/projects
router.post('/', validate(createProjectSchema), (req: Request, res: Response) => {
  const { name, gitea_repo, gitea_url, branch } = req.body;

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
  createGiteaWebhook(gitea_url, gitea_repo);
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
router.patch('/:id', validate(updateProjectSchema), (req: Request, res: Response) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(paramId(req)) as Record<string, unknown> | undefined;
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const { name, branch, env_vars } = req.body;
  const updates: string[] = [];
  const values: unknown[] = [];

  if (name !== undefined) {
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

  const hostId = project.host_id as string | null;
  const containerName = `shipit-${project.name as string}`;
  if (hostId) {
    try {
      await exec(hostId, `docker stop ${containerName} 2>/dev/null; docker rm ${containerName} 2>/dev/null; true`);
    } catch {
      // Ignore SSH errors during delete
    }
  }

  db.prepare('DELETE FROM deploys WHERE project_id = ?').run(paramId(req));
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

// POST /api/projects/:id/stop
router.post('/:id/stop', async (req: Request, res: Response) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(paramId(req)) as Record<string, unknown> | undefined;
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  if (project.status !== 'running') {
    res.status(400).json({ error: 'Project is not running' });
    return;
  }

  const hostId = project.host_id as string | null;
  const containerName = `shipit-${project.name as string}`;
  if (hostId) {
    try {
      await exec(hostId, `docker stop ${containerName} 2>/dev/null; true`);
    } catch {
      // Ignore SSH errors during stop
    }
  }

  db.prepare('UPDATE projects SET status = ?, container_id = NULL, updated_at = ? WHERE id = ?').run('stopped', Date.now(), paramId(req));
  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(paramId(req));
  res.json(updated);
});

// POST /api/projects/:id/start
router.post('/:id/start', (req: Request, res: Response) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(paramId(req)) as Record<string, unknown> | undefined;
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  if (project.status !== 'stopped') {
    res.status(400).json({ error: 'Project is not stopped' });
    return;
  }

  enqueueBuild(paramId(req));
  res.json({ message: 'Rebuild queued — project will be back online shortly' });
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
