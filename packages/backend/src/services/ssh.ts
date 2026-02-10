import { Client, type ConnectConfig } from 'ssh2';
import * as fs from 'fs';
import db from '../db/connection.js';

interface SSHExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

interface HostRecord {
  id: string;
  name: string;
  ip_address: string;
  ssh_port: number;
  ssh_user: string;
  ssh_key_path: string | null;
}

const connections = new Map<string, Client>();

function getHostConfig(hostId: string): HostRecord {
  const host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(hostId) as HostRecord | undefined;
  if (!host) {
    throw new Error(`Host not found: ${hostId}`);
  }
  return host;
}

function buildConnectConfig(host: HostRecord): ConnectConfig {
  const cfg: ConnectConfig = {
    host: host.ip_address,
    port: host.ssh_port,
    username: host.ssh_user,
    readyTimeout: 10000,
  };

  if (host.ssh_key_path) {
    cfg.privateKey = fs.readFileSync(host.ssh_key_path);
  }

  return cfg;
}

async function getConnection(hostId: string): Promise<Client> {
  const existing = connections.get(hostId);
  if (existing) {
    // Check if connection is still alive by checking internal state
    // ssh2 Client doesn't expose a simple 'connected' boolean, so we
    // rely on the 'close'/'end' listeners we attach below to clean up.
    return existing;
  }

  const host = getHostConfig(hostId);
  const cfg = buildConnectConfig(host);

  return new Promise<Client>((resolve, reject) => {
    const client = new Client();

    client.on('ready', () => {
      connections.set(hostId, client);
      resolve(client);
    });

    client.on('error', (err) => {
      connections.delete(hostId);
      reject(err);
    });

    client.on('close', () => {
      connections.delete(hostId);
    });

    client.on('end', () => {
      connections.delete(hostId);
    });

    client.connect(cfg);
  });
}

export async function exec(hostId: string, command: string, timeout = 30000): Promise<SSHExecResult> {
  const client = await getConnection(hostId);

  return new Promise<SSHExecResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);

    client.exec(command, (err, stream) => {
      if (err) {
        clearTimeout(timer);
        reject(err);
        return;
      }

      let stdout = '';
      let stderr = '';

      stream.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      stream.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      stream.on('close', (code: number) => {
        clearTimeout(timer);
        resolve({ stdout, stderr, code: code ?? 0 });
      });

      stream.on('error', (streamErr: Error) => {
        clearTimeout(timer);
        reject(streamErr);
      });
    });
  });
}

export async function execStream(
  hostId: string,
  command: string,
  onData: (line: string) => void,
  timeout = 30000,
): Promise<number> {
  const client = await getConnection(hostId);

  return new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);

    client.exec(command, (err, stream) => {
      if (err) {
        clearTimeout(timer);
        reject(err);
        return;
      }

      let buffer = '';

      stream.on('data', (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          onData(line);
        }
      });

      stream.stderr.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (line) onData(line);
        }
      });

      stream.on('close', (code: number) => {
        clearTimeout(timer);
        if (buffer) onData(buffer);
        resolve(code ?? 0);
      });

      stream.on('error', (streamErr: Error) => {
        clearTimeout(timer);
        reject(streamErr);
      });
    });
  });
}

export function disconnect(hostId: string): void {
  const client = connections.get(hostId);
  if (client) {
    client.end();
    connections.delete(hostId);
  }
}

export function disconnectAll(): void {
  for (const [id, client] of connections) {
    client.end();
    connections.delete(id);
  }
}

export async function testConnection(hostId: string): Promise<{ success: boolean; message: string }> {
  try {
    // Force a fresh connection for testing
    disconnect(hostId);
    const result = await exec(hostId, 'echo ok', 10000);
    if (result.code === 0 && result.stdout.trim() === 'ok') {
      return { success: true, message: 'SSH connection successful' };
    }
    return { success: false, message: `Unexpected output: ${result.stderr || result.stdout}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, message };
  }
}
