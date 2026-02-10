import * as http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'url';
import { Client } from 'ssh2';
import * as fs from 'fs';
import db from '../db/connection.js';

const clients = new Map<string, Set<WebSocket>>();

interface HostRecord {
  id: string;
  ip_address: string;
  ssh_port: number;
  ssh_user: string;
  ssh_key_path: string | null;
}

export function setupWebSocket(server: http.Server): void {
  const wss = new WebSocketServer({ server, path: undefined });

  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url ?? '/', `http://${request.headers.host}`).pathname;

    // Deploy logs: /ws/logs/<deployId>
    const deployMatch = pathname.match(/^\/ws\/logs\/([^/]+)$/);
    // Live logs: /ws/logs/live/<hostId>/<source>
    const liveMatch = pathname.match(/^\/ws\/logs\/live\/([^/]+)\/(.+)$/);

    if (!deployMatch && !liveMatch) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      if (liveMatch) {
        const hostId = liveMatch[1];
        const source = liveMatch[2];
        handleLiveLogs(ws, hostId, source);
      } else if (deployMatch) {
        const deployId = deployMatch[1];
        if (!clients.has(deployId)) {
          clients.set(deployId, new Set());
        }
        clients.get(deployId)!.add(ws);

        ws.on('close', () => {
          const set = clients.get(deployId);
          if (set) {
            set.delete(ws);
            if (set.size === 0) clients.delete(deployId);
          }
        });
      }
    });
  });
}

export function emitLog(deployId: string, line: string): void {
  const set = clients.get(deployId);
  if (!set) return;

  const message = JSON.stringify({ deployId, line, ts: Date.now() });
  for (const ws of set) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}

function handleLiveLogs(ws: WebSocket, hostId: string, source: string): void {
  const host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(hostId) as HostRecord | undefined;
  if (!host) {
    ws.send(JSON.stringify({ error: 'Host not found' }));
    ws.close();
    return;
  }

  const client = new Client();
  let closed = false;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    try { client.end(); } catch { /* ignore */ }
  };

  ws.on('close', cleanup);
  ws.on('error', cleanup);

  const connectConfig: Record<string, unknown> = {
    host: host.ip_address,
    port: host.ssh_port,
    username: host.ssh_user,
    readyTimeout: 10000,
  };

  if (host.ssh_key_path) {
    connectConfig.privateKey = fs.readFileSync(host.ssh_key_path);
  }

  client.on('ready', () => {
    let command: string;

    if (source.startsWith('container:')) {
      const containerName = source.slice('container:'.length);
      command = `docker logs -f --tail 50 ${containerName} 2>&1`;
    } else {
      // system logs
      command = 'journalctl -f -o short --no-pager';
    }

    client.exec(command, (err, stream) => {
      if (err) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ error: err.message }));
        }
        cleanup();
        return;
      }

      let buffer = '';

      stream.on('data', (data: Buffer) => {
        if (closed) return;
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ hostId, source, line, ts: Date.now() }));
          }
        }
      });

      stream.stderr.on('data', (data: Buffer) => {
        if (closed) return;
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (line && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ hostId, source, line, ts: Date.now() }));
          }
        }
      });

      stream.on('close', () => {
        cleanup();
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });
    });
  });

  client.on('error', (err) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ error: err.message }));
    }
    cleanup();
  });

  client.connect(connectConfig as Parameters<typeof client.connect>[0]);
}
