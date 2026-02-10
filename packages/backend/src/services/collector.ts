import db from '../db/connection.js';
import * as proxmox from './proxmox.js';
import { exec } from './ssh.js';
import { logger } from '../logger.js';

let collectorInterval: ReturnType<typeof setInterval> | null = null;
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

export function startCollector(): void {
  // Collect immediately, then every 60 seconds
  collectAll();
  collectorInterval = setInterval(collectAll, 60_000);

  // Cleanup old metrics every hour
  cleanupInterval = setInterval(cleanupOldMetrics, 3600_000);
}

export function stopCollector(): void {
  if (collectorInterval) clearInterval(collectorInterval);
  if (cleanupInterval) clearInterval(cleanupInterval);
}

async function collectAll(): Promise<void> {
  const hosts = db.prepare('SELECT * FROM hosts').all() as Record<string, unknown>[];

  for (const host of hosts) {
    try {
      await collectHostMetrics(host);
    } catch (err) {
      logger.error({ err, host: host.name }, 'Failed to collect metrics for host');
      // Mark host as offline
      db.prepare('UPDATE hosts SET status = ?, updated_at = ? WHERE id = ?')
        .run('offline', Date.now(), host.id);
    }
  }
}

async function collectHostMetrics(host: Record<string, unknown>): Promise<void> {
  const hostId = host.id as string;
  const now = Date.now();

  // 1. Try Proxmox API if vmid is set
  const vmid = host.proxmox_vmid as number | null;
  if (vmid) {
    try {
      // Get first node (homelab typically has one node)
      const nodes = await proxmox.getNodes();
      if (nodes.length > 0) {
        const node = nodes[0].node;
        const type = (host.type as string) === 'ct' ? 'ct' : 'vm';
        // Determine qemu vs lxc based on host type
        const vmType = type === 'ct' ? 'lxc' : 'qemu';
        const status = await proxmox.getVMStatus(node, vmid, vmType);

        const insert = db.prepare(
          'INSERT INTO metrics (host_id, source, metric_name, metric_value, unit, collected_at) VALUES (?, ?, ?, ?, ?, ?)'
        );

        insert.run(hostId, 'proxmox', 'cpu', status.cpu * 100, '%', now);
        insert.run(hostId, 'proxmox', 'memory_used', status.mem, 'bytes', now);
        insert.run(hostId, 'proxmox', 'memory_total', status.maxmem, 'bytes', now);
        insert.run(hostId, 'proxmox', 'disk_used', status.disk, 'bytes', now);
        insert.run(hostId, 'proxmox', 'disk_total', status.maxdisk, 'bytes', now);
        insert.run(hostId, 'proxmox', 'netin', status.netin, 'bytes', now);
        insert.run(hostId, 'proxmox', 'netout', status.netout, 'bytes', now);
        insert.run(hostId, 'proxmox', 'uptime', status.uptime, 'seconds', now);

        // Mark host as online
        db.prepare('UPDATE hosts SET status = ?, last_seen_at = ?, updated_at = ? WHERE id = ?')
          .run('online', now, now, hostId);
      }
    } catch (err) {
      logger.error({ err, host: host.name }, 'Proxmox metrics failed');
    }
  }

  // 2. Docker container metrics via SSH (if host has Docker)
  if (host.has_docker) {
    try {
      const result = await exec(hostId, 'docker stats --no-stream --format "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.NetIO}}|{{.BlockIO}}"');
      if (result.code === 0 && result.stdout.trim()) {
        const insert = db.prepare(
          'INSERT INTO metrics (host_id, source, metric_name, metric_value, unit, container_name, collected_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        );

        for (const line of result.stdout.trim().split('\n')) {
          const parts = line.split('|');
          if (parts.length < 3) continue;

          const containerName = parts[0].trim();
          const cpuStr = parts[1].trim().replace('%', '');
          const cpu = parseFloat(cpuStr) || 0;

          // Parse memory: "123MiB / 256MiB"
          const memParts = parts[2].trim().split('/');
          const memUsed = parseMemory(memParts[0]?.trim() ?? '0');
          const memTotal = parseMemory(memParts[1]?.trim() ?? '0');

          insert.run(hostId, 'docker', 'container_cpu', cpu, '%', containerName, now);
          insert.run(hostId, 'docker', 'container_memory_used', memUsed, 'bytes', containerName, now);
          insert.run(hostId, 'docker', 'container_memory_total', memTotal, 'bytes', containerName, now);
        }
      }

      // If Proxmox didn't mark it online, SSH success means online
      if (!vmid) {
        db.prepare('UPDATE hosts SET status = ?, last_seen_at = ?, updated_at = ? WHERE id = ?')
          .run('online', now, now, hostId);
      }
    } catch {
      // Docker stats failed, host might still be online via Proxmox
    }
  }
}

function parseMemory(str: string): number {
  const num = parseFloat(str) || 0;
  if (str.includes('GiB')) return num * 1024 * 1024 * 1024;
  if (str.includes('MiB')) return num * 1024 * 1024;
  if (str.includes('KiB')) return num * 1024;
  if (str.includes('GB')) return num * 1000 * 1000 * 1000;
  if (str.includes('MB')) return num * 1000 * 1000;
  if (str.includes('KB')) return num * 1000;
  return num;
}

function cleanupOldMetrics(): void {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  db.prepare('DELETE FROM metrics WHERE collected_at < ?').run(sevenDaysAgo);
}
