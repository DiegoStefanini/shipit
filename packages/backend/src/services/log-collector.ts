import db from '../db/connection.js';
import { exec } from './ssh.js';
import { parseDockerLog, parseJournalctlJson, detectLevel } from './log-parser.js';
import { logger } from '../logger.js';

let collectorInterval: ReturnType<typeof setInterval> | null = null;
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

const lastCollected = new Map<string, number>();

export function startLogCollector(): void {
  collectAllLogs();
  collectorInterval = setInterval(collectAllLogs, 60_000);
  cleanupInterval = setInterval(cleanupOldLogs, 3_600_000);
}

export function stopLogCollector(): void {
  if (collectorInterval) clearInterval(collectorInterval);
  if (cleanupInterval) clearInterval(cleanupInterval);
}

async function collectAllLogs(): Promise<void> {
  const hosts = db.prepare('SELECT * FROM hosts').all() as Record<string, unknown>[];
  for (const host of hosts) {
    try {
      await collectHostLogs(host);
    } catch (err) {
      logger.error({ err, host: host.name }, 'Log collection failed');
    }
  }
}

async function collectHostLogs(host: Record<string, unknown>): Promise<void> {
  const hostId = host.id as string;
  const now = Date.now();

  // 1. Docker container logs
  if (host.has_docker) {
    try {
      const listResult = await exec(hostId, 'docker ps --format "{{.Names}}"');
      if (listResult.code === 0) {
        const containers = listResult.stdout.trim().split('\n').filter(Boolean);
        for (const container of containers) {
          const key = `${hostId}:container:${container}`;
          const since = lastCollected.get(key);
          const sinceFlag = since ? `--since ${Math.floor(since / 1000)}` : '--since 2m';

          const logResult = await exec(hostId, `docker logs ${sinceFlag} --timestamps ${container} 2>&1`, 15_000);
          if (logResult.code === 0 && logResult.stdout.trim()) {
            const insert = db.prepare(
              'INSERT INTO logs (host_id, source, container_name, level, message, timestamp, collected_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            );

            for (const line of logResult.stdout.trim().split('\n')) {
              if (!line.trim()) continue;
              const parsed = parseDockerLog(line);
              insert.run(hostId, 'container', container, parsed.level, parsed.message, parsed.timestamp, now);
            }
          }
          lastCollected.set(key, now);
        }
      }
    } catch {
      // Docker logs failed
    }
  }

  // 2. System logs via journalctl
  try {
    const key = `${hostId}:system`;
    const since = lastCollected.get(key);
    const sinceFlag = since ? `--since "@${Math.floor(since / 1000)}"` : '--since "2 minutes ago"';

    const result = await exec(hostId, `journalctl ${sinceFlag} -o json --no-pager -n 500 2>/dev/null`, 15_000);
    if (result.code === 0 && result.stdout.trim()) {
      const insert = db.prepare(
        'INSERT INTO logs (host_id, source, service_name, level, message, timestamp, collected_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      );

      for (const line of result.stdout.trim().split('\n')) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          const parsed = parseJournalctlJson(json);
          if (parsed.message) {
            insert.run(hostId, 'system', parsed.service ?? '', parsed.level, parsed.message, parsed.timestamp, now);
          }
        } catch {
          // Skip unparseable lines
        }
      }
    }
    lastCollected.set(key, now);
  } catch {
    // journalctl failed
  }
}

function cleanupOldLogs(): void {
  const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
  db.prepare('DELETE FROM logs WHERE collected_at < ?').run(threeDaysAgo);
}
