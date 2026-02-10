import db from '../db/connection.js';
import { config } from '../config.js';
import { emitLog } from '../ws/logs.js';
import { exec, execStream } from '../services/ssh.js';
import { generateDockerfile, portForLanguage } from './dockerfiles.js';
import { detectLanguageRemote } from './detector.js';
import { logger } from '../logger.js';

const SAFE_REF = /^[a-zA-Z0-9._\-\/]+$/;

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
    logger.error({ err }, 'Build failed unexpectedly');
  } finally {
    building = false;
    processQueue();
  }
}

async function runBuild(projectId: string): Promise<void> {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Record<string, unknown> | undefined;
  if (!project) {
    logger.error({ projectId }, 'Project not found');
    return;
  }

  const hostId = project.host_id as string | null;
  if (!hostId) {
    const deployId = crypto.randomUUID();
    const now = Date.now();
    db.prepare(
      'INSERT INTO deploys (id, project_id, status, started_at, finished_at) VALUES (?, ?, ?, ?, ?)',
    ).run(deployId, projectId, 'failed', now, now);
    db.prepare('UPDATE deploys SET log = ? WHERE id = ?').run(
      'Deploy failed: no target host configured. Add a host in Settings and assign it to this project.\n',
      deployId,
    );
    db.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?').run('failed', now, projectId);
    emitLog(deployId, 'Deploy failed: no target host configured. Add a host in Settings and assign it to this project.');
    return;
  }

  // Verify host exists
  const host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(hostId) as Record<string, unknown> | undefined;
  if (!host) {
    const deployId = crypto.randomUUID();
    const now = Date.now();
    db.prepare(
      'INSERT INTO deploys (id, project_id, status, started_at, finished_at) VALUES (?, ?, ?, ?, ?)',
    ).run(deployId, projectId, 'failed', now, now);
    db.prepare('UPDATE deploys SET log = ? WHERE id = ?').run(
      `Deploy failed: host ${hostId} not found.\n`,
      deployId,
    );
    db.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?').run('failed', now, projectId);
    emitLog(deployId, `Deploy failed: host ${hostId} not found.`);
    return;
  }

  const deployId = crypto.randomUUID();
  const now = Date.now();
  const name = project.name as string;
  const repo = project.gitea_repo as string;
  const giteaUrl = project.gitea_url as string;
  const branch = (project.branch as string) || 'main';
  const buildDir = `/tmp/shipit-builds/${name}-${deployId}`;
  let logBuffer = '';

  // Create deploy record
  db.prepare(
    'INSERT INTO deploys (id, project_id, status, started_at) VALUES (?, ?, ?, ?)',
  ).run(deployId, projectId, 'building', now);
  db.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?').run('building', now, projectId);

  function log(line: string): void {
    logBuffer += line + '\n';
    db.prepare('UPDATE deploys SET log = ? WHERE id = ?').run(logBuffer, deployId);
    emitLog(deployId, line);
  }

  try {
    // Validate branch ref
    if (!SAFE_REF.test(branch)) {
      throw new Error(`Invalid branch ref: ${branch}`);
    }

    log(`Deploying ${name} from ${repo} (branch: ${branch})`);
    log(`Target host: ${host.name}`);

    // 1. Clone repo
    log('Cloning repository...');
    const cloneCmd = `git clone --depth 1 --branch ${branch} ${giteaUrl}/${repo}.git ${buildDir}`;
    const cloneCode = await execStream(hostId, cloneCmd, (line) => log(line), 120_000);
    if (cloneCode !== 0) {
      throw new Error(`Git clone failed with exit code ${cloneCode}`);
    }

    // 2. Get commit info
    const shaResult = await exec(hostId, `git -C ${buildDir} rev-parse HEAD`);
    const sha = shaResult.stdout.trim().substring(0, 12);
    const msgResult = await exec(hostId, `git -C ${buildDir} log -1 --format=%s`);
    const commitMsg = msgResult.stdout.trim();
    log(`Commit: ${sha} — ${commitMsg}`);

    // Update deploy with commit info
    db.prepare('UPDATE deploys SET commit_sha = ?, commit_msg = ? WHERE id = ?').run(sha, commitMsg, deployId);

    // 3. Detect language
    const language = await detectLanguageRemote(hostId, buildDir);
    log(`Detected language: ${language}`);

    // 4. Generate and write Dockerfile
    const dockerfileContent = generateDockerfile(language);
    const port = portForLanguage(language);
    // Use printf to safely write Dockerfile content to remote
    const escapedContent = dockerfileContent.replace(/\\/g, '\\\\').replace(/'/g, "'\\''");
    await exec(hostId, `printf '%s' '${escapedContent}' > ${buildDir}/Dockerfile`);
    log('Generated Dockerfile');

    // 5. Build Docker image
    log('Building Docker image...');
    const imageTag = `shipit-${name}:${sha}`;
    const buildCmd = `docker build -t ${imageTag} ${buildDir}`;
    const buildCode = await execStream(hostId, buildCmd, (line) => log(line), 600_000);
    if (buildCode !== 0) {
      throw new Error(`Docker build failed with exit code ${buildCode}`);
    }
    log('Image built successfully');

    // 6. Stop old container (ignore errors)
    log('Stopping old container...');
    const containerName = `shipit-${name}`;
    await exec(hostId, `docker stop ${containerName} 2>/dev/null; docker rm ${containerName} 2>/dev/null; true`);

    // 7. Build env flags
    let envFlags = '';
    const envVarsRaw = project.env_vars as string | null;
    if (envVarsRaw) {
      try {
        const envObj = JSON.parse(envVarsRaw) as Record<string, string>;
        for (const [key, value] of Object.entries(envObj)) {
          // Escape double quotes in values
          const safeVal = String(value).replace(/"/g, '\\"');
          envFlags += ` -e "${key}=${safeVal}"`;
        }
      } catch {
        log('Warning: failed to parse env_vars, skipping');
      }
    }

    // 8. Run new container
    log('Starting new container...');
    const baseDomain = config.baseDomain;
    const runCmd = [
      `docker run -d --name ${containerName}`,
      `--restart unless-stopped`,
      `--memory 256m`,
      `--network shipit-net`,
      `-l traefik.enable=true`,
      `-l "traefik.http.routers.app-${name}.rule=Host(\\\`${name}.${baseDomain}\\\`)"`,
      `-l "traefik.http.services.app-${name}.loadbalancer.server.port=${port}"`,
      `-l "traefik.docker.network=shipit-net"`,
      `-l "shipit.project=${name}"`,
      envFlags,
      imageTag,
    ].join(' ');

    const runResult = await exec(hostId, runCmd);
    if (runResult.code !== 0) {
      throw new Error(`Docker run failed: ${runResult.stderr}`);
    }
    const containerId = runResult.stdout.trim();
    log(`Container started: ${containerId.substring(0, 12)}`);

    // 9. Update project status
    db.prepare('UPDATE projects SET container_id = ?, status = ?, updated_at = ? WHERE id = ?')
      .run(containerId, 'running', Date.now(), projectId);

    // 10. Update deploy status
    db.prepare('UPDATE deploys SET status = ?, finished_at = ? WHERE id = ?')
      .run('success', Date.now(), deployId);
    log('Deploy completed successfully');

    // 11. Cleanup build dir
    await exec(hostId, `rm -rf ${buildDir}`).catch(() => {});

    // 12. Prune old images
    const pruneCmd = `docker images shipit-${name} --format '{{.ID}} {{.CreatedAt}}' | sort -k2 -r | tail -n +2 | awk '{print $1}' | xargs -r docker rmi -f 2>/dev/null; true`;
    await exec(hostId, pruneCmd).catch(() => {});

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`DEPLOY FAILED: ${message}`);
    db.prepare('UPDATE deploys SET status = ?, finished_at = ? WHERE id = ?')
      .run('failed', Date.now(), deployId);
    db.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?')
      .run('failed', Date.now(), projectId);

    // Cleanup build dir even on failure
    try {
      await exec(hostId, `rm -rf ${buildDir}`);
    } catch {
      // Ignore cleanup errors
    }
  }
}
