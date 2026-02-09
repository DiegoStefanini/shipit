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
  `);
}
