import { Router, Request, Response } from 'express';
import { exec } from 'node:child_process';
import path from 'node:path';
import db from '../db/connection.js';
import { enqueueBuild } from '../engine/builder.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

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

// POST /api/webhooks/gitea — self-deploy handler
// When the pushed repo matches config.selfRepo, trigger self-deploy
router.post('/gitea/self-deploy', (req: Request, res: Response) => {
  if (!config.selfDeployEnabled) {
    res.status(403).json({ error: 'Self-deploy is disabled' });
    return;
  }

  const secret = req.headers['x-gitea-secret'] as string | undefined ?? (req.query.secret as string | undefined);
  if (secret !== config.webhookSecret) {
    res.status(401).json({ error: 'Invalid webhook secret' });
    return;
  }

  const payload = req.body as GiteaWebhookPayload;
  const repoFullName = payload.repository?.full_name;

  if (!repoFullName || repoFullName !== config.selfRepo) {
    res.status(400).json({ error: `Repo mismatch: expected ${config.selfRepo}, got ${repoFullName}` });
    return;
  }

  const ref = payload.ref ?? '';
  if (ref && ref !== 'refs/heads/main') {
    res.json({ message: `Ignored push to ${ref}, self-deploy tracks main` });
    return;
  }

  const scriptPath = path.resolve('/opt/shipit/deploy/self-deploy.sh');
  logger.info({ repo: repoFullName, script: scriptPath }, 'Self-deploy triggered');

  res.json({ message: 'Self-deploy triggered' });

  exec(`bash ${scriptPath}`, { cwd: '/opt/shipit', timeout: 300_000 }, (error, stdout, stderr) => {
    if (error) {
      logger.error({ err: error, stderr }, 'Self-deploy failed');
      return;
    }
    logger.info({ stdout }, 'Self-deploy succeeded');
  });
});

export default router;
