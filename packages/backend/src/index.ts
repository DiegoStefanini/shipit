import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import * as http from 'http';
import { config } from './config.js';
import { initDb } from './db/schema.js';
import { setupWebSocket } from './ws/logs.js';
import projectsRouter from './routes/projects.js';
import webhooksRouter from './routes/webhooks.js';
import authRouter from './routes/auth.js';
import hostsRouter from './routes/hosts.js';
import settingsRouter from './routes/settings.js';
import { authMiddleware } from './middleware/auth.js';
import { authLimiter, apiLimiter } from './middleware/rate-limit.js';
import monitoringRouter from './routes/monitoring.js';
import { startCollector, stopCollector } from './services/collector.js';
import logsRouter from './routes/logs.js';
import securityRouter from './routes/security.js';
import { startLogCollector, stopLogCollector } from './services/log-collector.js';
import { startCrowdSecCollector, stopCrowdSecCollector } from './services/crowdsec.js';
import { disconnectAll } from './services/ssh.js';
import alertsRouter from './routes/alerts.js';
import { startAlertEvaluator, stopAlertEvaluator } from './services/alert-evaluator.js';
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

app.use('/api/auth', authLimiter, authRouter);
app.use('/api/projects', authMiddleware, apiLimiter, projectsRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/hosts', authMiddleware, apiLimiter, hostsRouter);
app.use('/api/settings', authMiddleware, apiLimiter, settingsRouter);
app.use('/api/monitoring', authMiddleware, apiLimiter, monitoringRouter);
app.use('/api/logs', authMiddleware, apiLimiter, logsRouter);
app.use('/api/security', authMiddleware, apiLimiter, securityRouter);
app.use('/api/alerts', authMiddleware, apiLimiter, alertsRouter);

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = http.createServer(app);
setupWebSocket(server);

initDb();
startCollector();
startLogCollector();
startCrowdSecCollector();
startAlertEvaluator();

server.listen(config.port, () => {
  console.log(`ShipIt backend listening on port ${config.port}`);
});

function shutdown() {
  console.log('Shutting down gracefully...');
  stopCollector();
  stopLogCollector();
  stopCrowdSecCollector();
  stopAlertEvaluator();
  disconnectAll();
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
