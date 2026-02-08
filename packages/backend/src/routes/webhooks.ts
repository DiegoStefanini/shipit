import { Router, Request, Response } from 'express';
import db from '../db/connection.js';
import { enqueueBuild } from '../engine/builder.js';
import { config } from '../config.js';

const router = Router();

interface GiteaWebhookPayload {
  ref?: string;
  repository?: {
    full_name?: string;
    name?: string;
  };
  after?: string;
  head_commit?: {
    message?: string;
  };
}

// POST /api/webhooks/gitea
router.post('/gitea', (req: Request, res: Response) => {
  const secret = req.headers['x-gitea-secret'] as string | undefined ?? (req.query.secret as string | undefined);
  if (secret !== config.webhookSecret) {
    res.status(401).json({ error: 'Invalid webhook secret' });
    return;
  }

  const payload = req.body as GiteaWebhookPayload;

  const repoFullName = payload.repository?.full_name;
  if (!repoFullName) {
    res.status(400).json({ error: 'Invalid webhook payload: missing repository info' });
    return;
  }

  // Find matching project by gitea_repo
  const project = db.prepare('SELECT * FROM projects WHERE gitea_repo = ?').get(repoFullName) as Record<string, unknown> | undefined;
  if (!project) {
    res.status(404).json({ error: `No project found for repo: ${repoFullName}` });
    return;
  }

  // Check if the push is to the tracked branch
  const branch = project.branch as string;
  const ref = payload.ref ?? '';
  if (ref && ref !== `refs/heads/${branch}`) {
    res.json({ message: `Ignored push to ${ref}, tracking ${branch}` });
    return;
  }

  enqueueBuild(project.id as string);
  res.json({ message: 'Deploy triggered', project: project.name });
});

export default router;
