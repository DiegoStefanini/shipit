import db from './connection.js';

export function initDb(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      gitea_repo TEXT NOT NULL,
      gitea_url TEXT NOT NULL,
      branch TEXT NOT NULL DEFAULT 'main',
      language TEXT,
      container_id TEXT,
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

  // Add host_id column to projects if it doesn't exist
  try {
    db.exec('ALTER TABLE projects ADD COLUMN host_id TEXT');
  } catch {
    // Column already exists
  }
}
