import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'url';

const clients = new Map<string, Set<WebSocket>>();

export function setupWebSocket(server: http.Server): void {
  const wss = new WebSocketServer({ server, path: undefined });

  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url ?? '/', `http://${request.headers.host}`).pathname;
    const match = pathname.match(/^\/ws\/logs\/(.+)$/);

    if (!match) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      const deployId = match[1];

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
