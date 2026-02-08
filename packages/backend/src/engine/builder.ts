import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import db from '../db/connection.js';
import { config } from '../config.js';
import { detectLanguage } from './detector.js';
import { generateDockerfile, portForLanguage } from './dockerfiles.js';
import { buildImage, runContainer, stopAndRemove, pruneOldImages } from './docker.js';
import { emitLog } from '../ws/logs.js';

interface QueueItem {
  projectId: string;
}

const queue: QueueItem[] = [];
let building = false;

export function enqueueBuild(projectId: string): void {
  queue.push({ projectId });
  processQueue();
}

async function processQueue(): Promise<void> {
  if (building || queue.length === 0) return;
  building = true;

  const item = queue.shift()!;
  try {
    await runBuild(item.projectId);
  } catch (err) {
    console.error('Build failed unexpectedly:', err);
  } finally {
    building = false;
    processQueue();
  }
}

async function runBuild(projectId: string): Promise<void> {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Record<string, unknown> | undefined;
  if (!project) {
    console.error(`Project ${projectId} not found`);
    return;
  }

  const name = project.name as string;
  const giteaUrl = project.gitea_url as string;
  const giteaRepo = project.gitea_repo as string;
  const branch = project.branch as string;

  // Create deploy record
  const deployId = crypto.randomUUID();
  const now = Date.now();
  db.prepare(
    'INSERT INTO deploys (id, project_id, status, started_at) VALUES (?, ?, ?, ?)',
  ).run(deployId, projectId, 'building', now);

  db.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?').run('building', now, projectId);

  const log = (line: string) => {
    emitLog(deployId, line);
    const current = db.prepare('SELECT log FROM deploys WHERE id = ?').get(deployId) as { log: string } | undefined;
    const newLog = (current?.log ?? '') + line + '\n';
    db.prepare('UPDATE deploys SET log = ? WHERE id = ?').run(newLog, deployId);
  };

  const repoDir = path.join(config.buildsDir, `${name}-${deployId}`);

  try {
    // Clone repo
    log(`Cloning ${giteaRepo} (branch: ${branch})...`);
    fs.mkdirSync(repoDir, { recursive: true });
    const cloneUrl = `${giteaUrl}/${giteaRepo}.git`;
    execSync(`git clone --depth 1 --branch ${branch} ${cloneUrl} ${repoDir}`, {
      stdio: 'pipe',
      timeout: 120_000,
    });

    // Get commit info
    let commitSha = '';
    let commitMsg = '';
    try {
      commitSha = execSync('git rev-parse HEAD', { cwd: repoDir, encoding: 'utf-8' }).trim();
      commitMsg = execSync('git log -1 --format=%s', { cwd: repoDir, encoding: 'utf-8' }).trim();
    } catch {
      // Non-critical
    }
    db.prepare('UPDATE deploys SET commit_sha = ?, commit_msg = ? WHERE id = ?').run(commitSha, commitMsg, deployId);
    log(`Commit: ${commitSha.substring(0, 8)} — ${commitMsg}`);

    // Detect language
    const language = detectLanguage(repoDir);
    db.prepare('UPDATE projects SET language = ?, updated_at = ? WHERE id = ?').run(language, Date.now(), projectId);
    log(`Detected language: ${language}`);

    // Write Dockerfile
    const dockerfile = generateDockerfile(language);
    fs.writeFileSync(path.join(repoDir, 'Dockerfile'), dockerfile);
    log('Generated Dockerfile');

    // Build image
    const imageTag = `shipit-${name}:${commitSha.substring(0, 12) || deployId.substring(0, 12)}`;
    log(`Building image: ${imageTag}...`);
    const imageId = await buildImage(repoDir, imageTag, log);
    db.prepare('UPDATE deploys SET image_id = ? WHERE id = ?').run(imageId, deployId);
    log('Image built successfully');

    // Stop old container
    const oldContainerId = project.container_id as string | null;
    if (oldContainerId) {
      log('Stopping old container...');
      await stopAndRemove(oldContainerId);
    }

    // Start new container
    const port = portForLanguage(language);
    const containerName = `shipit-${name}`;
    const labels: Record<string, string> = {
      'traefik.enable': 'true',
      [`traefik.http.routers.app-${name}.rule`]: `Host(\`${name}.stefaniniserver.com\`)`,
      [`traefik.http.services.app-${name}.loadbalancer.server.port`]: String(port),
      'traefik.docker.network': config.dockerNetwork,
      'shipit.project': name,
    };

    log(`Starting container ${containerName} on network ${config.dockerNetwork}...`);

    // Remove any leftover container with the same name
    try {
      await stopAndRemove(containerName);
    } catch {
      // Ignore
    }

    const containerId = await runContainer(containerName, imageTag, config.dockerNetwork, labels);
    log(`Container started: ${containerId.substring(0, 12)}`);

    // Update project
    db.prepare('UPDATE projects SET container_id = ?, status = ?, updated_at = ? WHERE id = ?').run(
      containerId,
      'running',
      Date.now(),
      projectId,
    );

    // Update deploy
    db.prepare('UPDATE deploys SET status = ?, finished_at = ? WHERE id = ?').run('success', Date.now(), deployId);
    log('Deploy completed successfully!');

    // Prune old images
    await pruneOldImages(name);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`DEPLOY FAILED: ${message}`);
    db.prepare('UPDATE deploys SET status = ?, finished_at = ? WHERE id = ?').run('failed', Date.now(), deployId);
    db.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?').run('failed', Date.now(), projectId);
  } finally {
    // Cleanup build dir
    try {
      fs.rmSync(repoDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}
