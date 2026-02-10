import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import { afterAll } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID, createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { mkdtempSync, rmSync } from 'fs';

// --- Test config overrides ---
// Must set env vars before importing any app code that reads config
process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASSWORD = 'testpass123';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.WEBHOOK_SECRET = 'test-webhook-secret';
process.env.GITEA_URL = 'http://localhost:3000';
process.env.GITEA_TOKEN = '';
process.env.BASE_DOMAIN = 'localhost';
process.env.DASHBOARD_DOMAIN = 'localhost';
process.env.SELF_DEPLOY_ENABLED = 'false';

const TEST_JWT_SECRET = 'test-jwt-secret-key';
const TEST_ADMIN_USER = 'admin';

// --- Temp directory for test DBs ---
let tempDir: string;

try {
  tempDir = mkdtempSync(join(tmpdir(), 'shipit-test-'));
} catch {
  tempDir = join(tmpdir(), `shipit-test-${randomUUID()}`);
}

// --- Create a fresh test database ---
export function createTestDb(): Database.Database {
  const dbPath = join(tempDir, `test-${randomUUID()}.db`);
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      gitea_repo TEXT NOT NULL,
      gitea_url TEXT NOT NULL,
      branch TEXT NOT NULL DEFAULT 'main',
      language TEXT,
      container_id TEXT,
      host_id TEXT,
      status TEXT NOT NULL DEFAULT 'idle',
      env_vars TEXT DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS deploys (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      commit_sha TEXT,
      commit_msg TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      log TEXT DEFAULT '',
      started_at INTEGER NOT NULL,
      finished_at INTEGER,
      image_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_deploys_project_id ON deploys(project_id);
    CREATE INDEX IF NOT EXISTS idx_projects_gitea_repo ON projects(gitea_repo);

    CREATE TABLE IF NOT EXISTS hosts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL DEFAULT 'vm',
      proxmox_vmid INTEGER,
      ip_address TEXT NOT NULL,
      ssh_port INTEGER NOT NULL DEFAULT 22,
      ssh_user TEXT NOT NULL DEFAULT 'root',
      ssh_key_path TEXT,
      has_docker INTEGER NOT NULL DEFAULT 0,
      has_crowdsec INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'unknown',
      last_seen_at INTEGER,
      poll_interval INTEGER DEFAULT 30,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      host_id TEXT NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
      source TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      metric_value REAL NOT NULL,
      unit TEXT,
      container_name TEXT,
      collected_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_metrics_host_time ON metrics(host_id, collected_at);
    CREATE INDEX IF NOT EXISTS idx_metrics_lookup ON metrics(host_id, metric_name, collected_at);

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      host_id TEXT NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
      source TEXT NOT NULL,
      container_name TEXT,
      service_name TEXT,
      level TEXT DEFAULT 'info',
      message TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      collected_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_logs_host_time ON logs(host_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_logs_search ON logs(host_id, source, level, timestamp);

    CREATE TABLE IF NOT EXISTS security_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      host_id TEXT NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
      alert_id TEXT,
      scenario TEXT NOT NULL,
      source_ip TEXT NOT NULL,
      source_country TEXT,
      source_as TEXT,
      events_count INTEGER DEFAULT 1,
      start_at TEXT,
      stop_at TEXT,
      collected_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS security_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      host_id TEXT NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
      decision_id TEXT,
      source_ip TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'ban',
      scenario TEXT,
      duration TEXT,
      origin TEXT DEFAULT 'crowdsec',
      created_at INTEGER NOT NULL,
      expires_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_security_alerts_host ON security_alerts(host_id, collected_at);
    CREATE INDEX IF NOT EXISTS idx_security_decisions_ip ON security_decisions(source_ip);
    CREATE INDEX IF NOT EXISTS idx_security_alerts_time ON security_alerts(collected_at);

    CREATE TABLE IF NOT EXISTS notification_channels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      config TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alert_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      condition TEXT NOT NULL,
      channel_ids TEXT NOT NULL,
      cooldown INTEGER DEFAULT 300,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_triggered_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alert_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_name TEXT,
      message TEXT NOT NULL,
      triggered_at INTEGER NOT NULL
    );
  `);

  return db;
}

// --- Generate a valid JWT token for test requests ---
export function getAuthToken(username: string = TEST_ADMIN_USER): string {
  return jwt.sign({ username }, TEST_JWT_SECRET, { expiresIn: '1h' });
}

// --- Create a test Express app with routes wired to a test DB ---
export function createTestApp(testDb: Database.Database) {
  // We need to build the app manually, substituting the test DB
  // Import middleware
  const { authMiddleware } = createAuthMiddleware(TEST_JWT_SECRET);

  const app = express();
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: '0.2.0', timestamp: Date.now() });
  });

  // Config
  app.get('/api/config', (_req, res) => {
    res.json({ baseDomain: 'localhost', giteaUrl: 'http://localhost:3000' });
  });

  // Auth routes
  app.use('/api/auth', createAuthRouter(testDb, TEST_JWT_SECRET));

  // Protected routes
  app.use('/api/projects', authMiddleware, createProjectsRouter(testDb));
  app.use('/api/hosts', authMiddleware, createHostsRouter(testDb));
  app.use('/api/settings', authMiddleware, createSettingsRouter(testDb));
  app.use('/api/alerts', authMiddleware, createAlertsRouter(testDb));
  app.use('/api/monitoring', authMiddleware, createMonitoringRouter(testDb));
  app.use('/api/logs', authMiddleware, createLogsRouter(testDb));
  app.use('/api/security', authMiddleware, createSecurityRouter(testDb));

  return app;
}

// --- Inline route/middleware factories that accept a db instance ---

function createAuthMiddleware(jwtSecret: string) {
  function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction): void {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const token = header.slice(7);
    try {
      const decoded = jwt.verify(token, jwtSecret) as { username: string };
      (req as any).user = decoded;
      next();
    } catch {
      res.status(401).json({ error: 'Unauthorized' });
    }
  }
  return { authMiddleware };
}

function createAuthRouter(db: Database.Database, jwtSecret: string) {
  const router = express.Router();

  router.post('/login', (req, res) => {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password required' });
      return;
    }
    if (username !== TEST_ADMIN_USER || password !== 'testpass123') {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const token = jwt.sign({ username }, jwtSecret, { expiresIn: '7d' });
    res.json({ token });
  });

  router.get('/me', createAuthMiddleware(jwtSecret).authMiddleware, (req, res) => {
    res.json({ username: (req as any).user.username });
  });

  return router;
}

function createProjectsRouter(db: Database.Database) {
  const router = express.Router();
  const NAME_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

  function paramId(req: express.Request): string {
    const id = req.params.id;
    return Array.isArray(id) ? id[0] : id;
  }

  router.get('/', (_req, res) => {
    const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
    res.json(projects);
  });

  router.post('/', (req, res) => {
    const { name, gitea_repo, gitea_url, branch } = req.body;
    if (!name || !gitea_repo || !gitea_url) {
      res.status(400).json({ error: 'name, gitea_repo, and gitea_url are required' });
      return;
    }
    if (!NAME_REGEX.test(name)) {
      res.status(400).json({ error: 'name must be lowercase alphanumeric with hyphens only' });
      return;
    }
    const id = randomUUID();
    const now = Date.now();
    try {
      db.prepare(
        `INSERT INTO projects (id, name, gitea_repo, gitea_url, branch, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(id, name, gitea_repo, gitea_url, branch ?? 'main', now, now);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('UNIQUE')) {
        res.status(409).json({ error: 'Project name already exists' });
        return;
      }
      throw err;
    }
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    res.status(201).json(project);
  });

  router.get('/:id', (req, res) => {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(paramId(req));
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json(project);
  });

  router.patch('/:id', (req, res) => {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(paramId(req)) as Record<string, unknown> | undefined;
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    const { name, branch, env_vars } = req.body;
    const updates: string[] = [];
    const values: unknown[] = [];
    if (name !== undefined) {
      if (!NAME_REGEX.test(name)) {
        res.status(400).json({ error: 'name must be lowercase alphanumeric with hyphens only' });
        return;
      }
      updates.push('name = ?');
      values.push(name);
    }
    if (branch !== undefined) { updates.push('branch = ?'); values.push(branch); }
    if (env_vars !== undefined) {
      updates.push('env_vars = ?');
      values.push(typeof env_vars === 'string' ? env_vars : JSON.stringify(env_vars));
    }
    if (updates.length === 0) {
      res.json(project);
      return;
    }
    updates.push('updated_at = ?');
    values.push(Date.now());
    values.push(paramId(req));
    db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(paramId(req));
    res.json(updated);
  });

  router.delete('/:id', (req, res) => {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(paramId(req));
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    db.prepare('DELETE FROM deploys WHERE project_id = ?').run(paramId(req));
    db.prepare('DELETE FROM projects WHERE id = ?').run(paramId(req));
    res.status(204).end();
  });

  router.get('/:id/deploys', (req, res) => {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(paramId(req));
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    const deploys = db.prepare(
      'SELECT * FROM deploys WHERE project_id = ? ORDER BY started_at DESC',
    ).all(paramId(req));
    res.json(deploys);
  });

  return router;
}

function createHostsRouter(db: Database.Database) {
  const router = express.Router();

  function paramId(req: express.Request): string {
    const id = req.params.id;
    return Array.isArray(id) ? id[0] : id;
  }

  router.get('/', (_req, res) => {
    const hosts = db.prepare('SELECT * FROM hosts ORDER BY created_at DESC').all();
    res.json(hosts);
  });

  router.post('/', (req, res) => {
    const { name, type, proxmox_vmid, ip_address, ssh_port, ssh_user, ssh_key_path, has_docker, has_crowdsec } = req.body;
    if (!name || !ip_address) {
      res.status(400).json({ error: 'name and ip_address are required' });
      return;
    }
    const id = randomUUID();
    const now = Date.now();
    try {
      db.prepare(
        `INSERT INTO hosts (id, name, type, proxmox_vmid, ip_address, ssh_port, ssh_user, ssh_key_path, has_docker, has_crowdsec, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(id, name, type ?? 'vm', proxmox_vmid ?? null, ip_address, ssh_port ?? 22, ssh_user ?? 'root', ssh_key_path ?? null, has_docker ? 1 : 0, has_crowdsec ? 1 : 0, now, now);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('UNIQUE')) {
        res.status(409).json({ error: 'Host name already exists' });
        return;
      }
      throw err;
    }
    const host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(id);
    res.status(201).json(host);
  });

  router.get('/:id', (req, res) => {
    const host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(paramId(req));
    if (!host) {
      res.status(404).json({ error: 'Host not found' });
      return;
    }
    res.json(host);
  });

  router.patch('/:id', (req, res) => {
    const host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(paramId(req));
    if (!host) {
      res.status(404).json({ error: 'Host not found' });
      return;
    }
    const allowedFields = ['name', 'type', 'proxmox_vmid', 'ip_address', 'ssh_port', 'ssh_user', 'ssh_key_path', 'has_docker', 'has_crowdsec', 'poll_interval'];
    const updates: string[] = [];
    const values: unknown[] = [];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'has_docker' || field === 'has_crowdsec') {
          updates.push(`${field} = ?`);
          values.push(req.body[field] ? 1 : 0);
        } else {
          updates.push(`${field} = ?`);
          values.push(req.body[field]);
        }
      }
    }
    if (updates.length === 0) {
      res.json(host);
      return;
    }
    updates.push('updated_at = ?');
    values.push(Date.now());
    values.push(paramId(req));
    try {
      db.prepare(`UPDATE hosts SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('UNIQUE')) {
        res.status(409).json({ error: 'Host name already exists' });
        return;
      }
      throw err;
    }
    const updated = db.prepare('SELECT * FROM hosts WHERE id = ?').get(paramId(req));
    res.json(updated);
  });

  router.delete('/:id', (req, res) => {
    const host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(paramId(req));
    if (!host) {
      res.status(404).json({ error: 'Host not found' });
      return;
    }
    db.prepare('DELETE FROM hosts WHERE id = ?').run(paramId(req));
    res.status(204).end();
  });

  return router;
}

function createSettingsRouter(db: Database.Database) {
  const router = express.Router();

  // Inline encrypt/decrypt for test isolation
  const ALGORITHM = 'aes-256-gcm';
  const IV_LENGTH = 16;
  const SALT_LENGTH = 16;
  const KEY_LENGTH = 32;

  function encrypt(text: string, secret: string): string {
    const salt = randomBytes(SALT_LENGTH);
    const key = scryptSync(secret, salt, KEY_LENGTH);
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
  }

  function decrypt(encrypted: string, secret: string): string {
    const buf = Buffer.from(encrypted, 'base64');
    const salt = buf.subarray(0, SALT_LENGTH);
    const iv = buf.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = buf.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + 16);
    const content = buf.subarray(SALT_LENGTH + IV_LENGTH + 16);
    const key = scryptSync(secret, salt, KEY_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(content) + decipher.final('utf8');
  }

  interface SettingRow { key: string; value: string; updated_at: number; }

  router.get('/proxmox', (_req, res) => {
    const urlRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('proxmox_url') as SettingRow | undefined;
    const tokenIdRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('proxmox_token_id') as SettingRow | undefined;
    const tokenSecretRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('proxmox_token_secret') as SettingRow | undefined;

    if (!urlRow || !tokenIdRow) {
      res.json({ configured: false, url: null, tokenId: null, tokenSecret: null });
      return;
    }

    let maskedSecret: string | null = null;
    if (tokenSecretRow) {
      try {
        const secret = decrypt(tokenSecretRow.value, TEST_JWT_SECRET);
        maskedSecret = secret.slice(0, 8) + '****';
      } catch {
        maskedSecret = '****';
      }
    }

    res.json({ configured: true, url: urlRow.value, tokenId: tokenIdRow.value, tokenSecret: maskedSecret });
  });

  router.put('/proxmox', (req, res) => {
    const { url, tokenId, tokenSecret } = req.body;
    if (!url || !tokenId || !tokenSecret) {
      res.status(400).json({ error: 'url, tokenId, and tokenSecret are required' });
      return;
    }
    const now = Date.now();
    const encryptedSecret = encrypt(tokenSecret, TEST_JWT_SECRET);
    const upsert = db.prepare(
      'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
    );
    const transaction = db.transaction(() => {
      upsert.run('proxmox_url', url, now);
      upsert.run('proxmox_token_id', tokenId, now);
      upsert.run('proxmox_token_secret', encryptedSecret, now);
    });
    transaction();
    res.json({ message: 'Proxmox settings saved' });
  });

  return router;
}

function createAlertsRouter(db: Database.Database) {
  const router = express.Router();

  // --- Notification Channels ---
  router.get('/channels', (_req, res) => {
    const channels = db.prepare('SELECT * FROM notification_channels ORDER BY created_at DESC').all();
    res.json(channels);
  });

  router.post('/channels', (req, res) => {
    const { name, type, config: channelConfig } = req.body;
    if (!name || !type || !channelConfig) {
      res.status(400).json({ error: 'name, type, and config are required' });
      return;
    }
    const id = randomUUID();
    const now = Date.now();
    const configStr = typeof channelConfig === 'string' ? channelConfig : JSON.stringify(channelConfig);
    db.prepare('INSERT INTO notification_channels (id, name, type, config, enabled, created_at) VALUES (?, ?, ?, ?, 1, ?)')
      .run(id, name, type, configStr, now);
    const channel = db.prepare('SELECT * FROM notification_channels WHERE id = ?').get(id);
    res.status(201).json(channel);
  });

  router.patch('/channels/:id', (req, res) => {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM notification_channels WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }
    const { name, type, config: channelConfig, enabled } = req.body;
    const updates: string[] = [];
    const params: unknown[] = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (type !== undefined) { updates.push('type = ?'); params.push(type); }
    if (channelConfig !== undefined) {
      const configStr = typeof channelConfig === 'string' ? channelConfig : JSON.stringify(channelConfig);
      updates.push('config = ?');
      params.push(configStr);
    }
    if (enabled !== undefined) { updates.push('enabled = ?'); params.push(enabled ? 1 : 0); }
    if (updates.length > 0) {
      params.push(id);
      db.prepare(`UPDATE notification_channels SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }
    const channel = db.prepare('SELECT * FROM notification_channels WHERE id = ?').get(id);
    res.json(channel);
  });

  router.delete('/channels/:id', (req, res) => {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM notification_channels WHERE id = ?').run(id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }
    res.json({ success: true });
  });

  // --- Alert Rules ---
  router.get('/rules', (_req, res) => {
    const rules = db.prepare('SELECT * FROM alert_rules ORDER BY created_at DESC').all();
    res.json(rules);
  });

  router.post('/rules', (req, res) => {
    const { name, type, condition, channel_ids, cooldown } = req.body;
    if (!name || !type || !condition || !channel_ids) {
      res.status(400).json({ error: 'name, type, condition, and channel_ids are required' });
      return;
    }
    const id = randomUUID();
    const now = Date.now();
    const condStr = typeof condition === 'string' ? condition : JSON.stringify(condition);
    const chStr = typeof channel_ids === 'string' ? channel_ids : JSON.stringify(channel_ids);
    db.prepare('INSERT INTO alert_rules (id, name, type, condition, channel_ids, cooldown, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)')
      .run(id, name, type, condStr, chStr, cooldown ?? 300, now);
    const rule = db.prepare('SELECT * FROM alert_rules WHERE id = ?').get(id);
    res.status(201).json(rule);
  });

  router.patch('/rules/:id', (req, res) => {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM alert_rules WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ error: 'Rule not found' });
      return;
    }
    const { name, type, condition, channel_ids, cooldown, enabled } = req.body;
    const updates: string[] = [];
    const params: unknown[] = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (type !== undefined) { updates.push('type = ?'); params.push(type); }
    if (condition !== undefined) {
      const condStr = typeof condition === 'string' ? condition : JSON.stringify(condition);
      updates.push('condition = ?');
      params.push(condStr);
    }
    if (channel_ids !== undefined) {
      const chStr = typeof channel_ids === 'string' ? channel_ids : JSON.stringify(channel_ids);
      updates.push('channel_ids = ?');
      params.push(chStr);
    }
    if (cooldown !== undefined) { updates.push('cooldown = ?'); params.push(cooldown); }
    if (enabled !== undefined) { updates.push('enabled = ?'); params.push(enabled ? 1 : 0); }
    if (updates.length > 0) {
      params.push(id);
      db.prepare(`UPDATE alert_rules SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }
    const rule = db.prepare('SELECT * FROM alert_rules WHERE id = ?').get(id);
    res.json(rule);
  });

  router.delete('/rules/:id', (req, res) => {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM alert_rules WHERE id = ?').run(id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Rule not found' });
      return;
    }
    res.json({ success: true });
  });

  // --- Alert History ---
  router.get('/history', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const total = (db.prepare('SELECT COUNT(*) as count FROM alert_history').get() as { count: number }).count;
    const history = db.prepare('SELECT * FROM alert_history ORDER BY triggered_at DESC LIMIT ? OFFSET ?').all(limit, offset);
    res.json({ history, total, limit, offset });
  });

  return router;
}

function createMonitoringRouter(db: Database.Database) {
  const router = express.Router();

  router.get('/overview', (_req, res) => {
    const hosts = db.prepare('SELECT * FROM hosts ORDER BY name').all() as Record<string, unknown>[];
    const overview = hosts.map(host => {
      const hostId = host.id as string;
      const latestMetrics = db.prepare(`
        SELECT metric_name, metric_value, unit, collected_at
        FROM metrics WHERE host_id = ? AND source = 'proxmox'
        AND collected_at = (SELECT MAX(collected_at) FROM metrics WHERE host_id = ? AND source = 'proxmox')
      `).all(hostId, hostId) as Record<string, unknown>[];
      const metricsMap: Record<string, number> = {};
      for (const m of latestMetrics) {
        metricsMap[m.metric_name as string] = m.metric_value as number;
      }
      return { host_id: hostId, host_name: host.name, host_type: host.type, status: host.status, last_seen_at: host.last_seen_at, metrics: metricsMap };
    });
    res.json(overview);
  });

  router.get('/hosts/:id', (req, res) => {
    const hostId = req.params.id;
    const from = parseInt(req.query.from as string) || (Date.now() - 3600_000);
    const to = parseInt(req.query.to as string) || Date.now();
    const host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(hostId);
    if (!host) {
      res.status(404).json({ error: 'Host not found' });
      return;
    }
    const metrics = db.prepare(`
      SELECT metric_name, metric_value, collected_at
      FROM metrics WHERE host_id = ? AND source = 'proxmox' AND collected_at BETWEEN ? AND ?
      ORDER BY collected_at ASC
    `).all(hostId, from, to) as Record<string, unknown>[];
    const series: Record<string, Array<{ t: number; v: number }>> = {};
    for (const m of metrics) {
      const name = m.metric_name as string;
      if (!series[name]) series[name] = [];
      series[name].push({ t: m.collected_at as number, v: m.metric_value as number });
    }
    res.json({ host_id: hostId, from, to, series });
  });

  router.get('/hosts/:id/containers', (req, res) => {
    const hostId = req.params.id;
    const host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(hostId);
    if (!host) {
      res.status(404).json({ error: 'Host not found' });
      return;
    }
    const latest = db.prepare(`
      SELECT container_name, metric_name, metric_value, collected_at
      FROM metrics WHERE host_id = ? AND source = 'docker'
      AND collected_at = (SELECT MAX(collected_at) FROM metrics WHERE host_id = ? AND source = 'docker')
      ORDER BY container_name
    `).all(hostId, hostId) as Record<string, unknown>[];
    const containers: Record<string, Record<string, number>> = {};
    for (const m of latest) {
      const name = m.container_name as string;
      if (!containers[name]) containers[name] = {};
      containers[name][m.metric_name as string] = m.metric_value as number;
    }
    res.json({ host_id: hostId, containers });
  });

  return router;
}

function createLogsRouter(db: Database.Database) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const { host_id, source, level, container, service, q, from, to } = req.query;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;
    let where = 'WHERE 1=1';
    const params: unknown[] = [];
    if (host_id) { where += ' AND host_id = ?'; params.push(host_id); }
    if (source) { where += ' AND source = ?'; params.push(source); }
    if (level) { where += ' AND level = ?'; params.push(level); }
    if (container) { where += ' AND container_name = ?'; params.push(container); }
    if (service) { where += ' AND service_name = ?'; params.push(service); }
    if (q) { where += ' AND message LIKE ?'; params.push(`%${q}%`); }
    if (from) { where += ' AND timestamp >= ?'; params.push(parseInt(from as string)); }
    if (to) { where += ' AND timestamp <= ?'; params.push(parseInt(to as string)); }
    const total = (db.prepare(`SELECT COUNT(*) as count FROM logs ${where}`).get(...params) as { count: number }).count;
    const logs = db.prepare(
      `SELECT l.*, h.name as host_name FROM logs l LEFT JOIN hosts h ON l.host_id = h.id ${where} ORDER BY l.timestamp DESC LIMIT ? OFFSET ?`,
    ).all(...params, limit, offset);
    res.json({ logs, total, limit, offset });
  });

  router.get('/hosts/:id', (req, res) => {
    const hostId = req.params.id;
    const { source, level, q } = req.query;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;
    let where = 'WHERE host_id = ?';
    const params: unknown[] = [hostId];
    if (source) { where += ' AND source = ?'; params.push(source); }
    if (level) { where += ' AND level = ?'; params.push(level); }
    if (q) { where += ' AND message LIKE ?'; params.push(`%${q}%`); }
    const total = (db.prepare(`SELECT COUNT(*) as count FROM logs ${where}`).get(...params) as { count: number }).count;
    const logs = db.prepare(
      `SELECT * FROM logs ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
    ).all(...params, limit, offset);
    res.json({ logs, total, limit, offset });
  });

  return router;
}

function createSecurityRouter(db: Database.Database) {
  const router = express.Router();

  router.get('/overview', (_req, res) => {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const totalAlerts24h = (db.prepare('SELECT COUNT(*) as count FROM security_alerts WHERE collected_at > ?').get(oneDayAgo) as { count: number }).count;
    const activeDecisions = (db.prepare('SELECT COUNT(*) as count FROM security_decisions').get() as { count: number }).count;
    const topScenarios = db.prepare(`
      SELECT scenario, COUNT(*) as count FROM security_alerts WHERE collected_at > ?
      GROUP BY scenario ORDER BY count DESC LIMIT 5
    `).all(oneDayAgo);
    const topCountries = db.prepare(`
      SELECT source_country, COUNT(*) as count FROM security_alerts WHERE collected_at > ? AND source_country != ''
      GROUP BY source_country ORDER BY count DESC LIMIT 5
    `).all(oneDayAgo);
    const alertsPerHour = db.prepare(`
      SELECT (collected_at / 3600000) * 3600000 as hour, COUNT(*) as count
      FROM security_alerts WHERE collected_at > ? GROUP BY hour ORDER BY hour ASC
    `).all(oneDayAgo);
    res.json({ total_alerts_24h: totalAlerts24h, active_decisions: activeDecisions, top_scenarios: topScenarios, top_countries: topCountries, alerts_per_hour: alertsPerHour });
  });

  router.get('/alerts', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const host_id = req.query.host_id as string | undefined;
    let where = 'WHERE 1=1';
    const params: unknown[] = [];
    if (host_id) { where += ' AND a.host_id = ?'; params.push(host_id); }
    const total = (db.prepare(`SELECT COUNT(*) as count FROM security_alerts a ${where}`).get(...params) as { count: number }).count;
    const alerts = db.prepare(`
      SELECT a.*, h.name as host_name FROM security_alerts a LEFT JOIN hosts h ON a.host_id = h.id
      ${where} ORDER BY a.collected_at DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    res.json({ alerts, total, limit, offset });
  });

  router.get('/decisions', (req, res) => {
    const host_id = req.query.host_id as string | undefined;
    let where = 'WHERE 1=1';
    const params: unknown[] = [];
    if (host_id) { where += ' AND d.host_id = ?'; params.push(host_id); }
    const decisions = db.prepare(`
      SELECT d.*, h.name as host_name FROM security_decisions d LEFT JOIN hosts h ON d.host_id = h.id
      ${where} ORDER BY d.created_at DESC
    `).all(...params);
    res.json(decisions);
  });

  return router;
}

// Cleanup temp directory after all tests
afterAll(() => {
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Best effort cleanup
  }
});
