import express from 'express';
import cors from 'cors';
import * as http from 'http';
import { config } from './config.js';
import { initDb } from './db/schema.js';
import { setupWebSocket } from './ws/logs.js';
import projectsRouter from './routes/projects.js';
import webhooksRouter from './routes/webhooks.js';
import authRouter from './routes/auth.js';
import { authMiddleware } from './middleware/auth.js';
import db from './db/connection.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: config.version, timestamp: Date.now() });
});

app.get('/api/config', (_req, res) => {
  res.json({ baseDomain: config.baseDomain, giteaUrl: config.giteaUrl });
});

app.use('/api/auth', authRouter);
app.use('/api/projects', authMiddleware, projectsRouter);
app.use('/api/webhooks', webhooksRouter);

const server = http.createServer(app);
setupWebSocket(server);

initDb();

server.listen(config.port, () => {
  console.log(`ShipIt backend listening on port ${config.port}`);
});

function shutdown() {
  console.log('Shutting down gracefully...');
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
