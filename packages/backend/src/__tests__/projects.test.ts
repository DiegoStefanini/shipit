import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type Database from 'better-sqlite3';
import { createTestDb, createTestApp, getAuthToken } from './setup.js';

describe('Projects API', () => {
  let app: Express;
  let db: Database.Database;
  let token: string;

  beforeAll(() => {
    db = createTestDb();
    app = createTestApp(db);
    token = getAuthToken();
  });

  afterAll(() => {
    db.close();
  });

  beforeEach(() => {
    db.exec('DELETE FROM deploys');
    db.exec('DELETE FROM projects');
  });

  const validProject = {
    name: 'my-app',
    gitea_repo: 'user/my-app',
    gitea_url: 'http://localhost:3000',
  };

  describe('GET /api/projects', () => {
    it('should return empty array initially', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return all projects', async () => {
      // Create two projects
      await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send(validProject);

      await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validProject, name: 'other-app', gitea_repo: 'user/other-app' });

      const res = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });
  });

  describe('POST /api/projects', () => {
    it('should create a project with valid data', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send(validProject);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('my-app');
      expect(res.body.gitea_repo).toBe('user/my-app');
      expect(res.body.branch).toBe('main');
      expect(res.body.status).toBe('idle');
    });

    it('should create a project with custom branch', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validProject, branch: 'develop' });

      expect(res.status).toBe(201);
      expect(res.body.branch).toBe('develop');
    });

    it('should reject missing name', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ gitea_repo: 'user/app', gitea_url: 'http://localhost:3000' });

      expect(res.status).toBe(400);
    });

    it('should reject missing gitea_repo', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'my-app', gitea_url: 'http://localhost:3000' });

      expect(res.status).toBe(400);
    });

    it('should reject missing gitea_url', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'my-app', gitea_repo: 'user/app' });

      expect(res.status).toBe(400);
    });

    it('should reject invalid name (uppercase)', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validProject, name: 'MyApp' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/name/i);
    });

    it('should reject invalid name (spaces)', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validProject, name: 'my app' });

      expect(res.status).toBe(400);
    });

    it('should reject invalid name (starting with hyphen)', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validProject, name: '-my-app' });

      expect(res.status).toBe(400);
    });

    it('should accept single char name', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validProject, name: 'a' });

      expect(res.status).toBe(201);
    });

    it('should return 409 for duplicate name', async () => {
      await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send(validProject);

      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send(validProject);

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already exists/i);
    });
  });

  describe('GET /api/projects/:id', () => {
    it('should return a project by id', async () => {
      const createRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send(validProject);

      const res = await request(app)
        .get(`/api/projects/${createRes.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(createRes.body.id);
      expect(res.body.name).toBe('my-app');
    });

    it('should return 404 for non-existent project', async () => {
      const res = await request(app)
        .get('/api/projects/non-existent-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });
  });

  describe('PATCH /api/projects/:id', () => {
    it('should update project name', async () => {
      const createRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send(validProject);

      const res = await request(app)
        .patch(`/api/projects/${createRes.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'renamed' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('renamed');
    });

    it('should update project branch', async () => {
      const createRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send(validProject);

      const res = await request(app)
        .patch(`/api/projects/${createRes.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ branch: 'develop' });

      expect(res.status).toBe(200);
      expect(res.body.branch).toBe('develop');
    });

    it('should update env_vars as object', async () => {
      const createRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send(validProject);

      const res = await request(app)
        .patch(`/api/projects/${createRes.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ env_vars: { NODE_ENV: 'production' } });

      expect(res.status).toBe(200);
      expect(JSON.parse(res.body.env_vars)).toEqual({ NODE_ENV: 'production' });
    });

    it('should reject invalid name on update', async () => {
      const createRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send(validProject);

      const res = await request(app)
        .patch(`/api/projects/${createRes.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'INVALID' });

      expect(res.status).toBe(400);
    });

    it('should return existing project if no fields sent', async () => {
      const createRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send(validProject);

      const res = await request(app)
        .patch(`/api/projects/${createRes.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('my-app');
    });

    it('should return 404 for non-existent project', async () => {
      const res = await request(app)
        .patch('/api/projects/non-existent-id')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'test' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('should delete an existing project', async () => {
      const createRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send(validProject);

      const delRes = await request(app)
        .delete(`/api/projects/${createRes.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(delRes.status).toBe(204);

      // Verify it's gone
      const getRes = await request(app)
        .get(`/api/projects/${createRes.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(getRes.status).toBe(404);
    });

    it('should return 404 for non-existent project', async () => {
      const res = await request(app)
        .delete('/api/projects/non-existent-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('should cascade delete deploys', async () => {
      const createRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send(validProject);

      const projectId = createRes.body.id;

      // Manually insert a deploy
      db.prepare(
        'INSERT INTO deploys (id, project_id, status, started_at) VALUES (?, ?, ?, ?)',
      ).run('deploy-1', projectId, 'success', Date.now());

      await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${token}`);

      const deploys = db.prepare('SELECT * FROM deploys WHERE project_id = ?').all(projectId);
      expect(deploys).toHaveLength(0);
    });
  });

  describe('GET /api/projects/:id/deploys', () => {
    it('should return empty deploys for new project', async () => {
      const createRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send(validProject);

      const res = await request(app)
        .get(`/api/projects/${createRes.body.id}/deploys`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return deploys for a project', async () => {
      const createRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send(validProject);

      const projectId = createRes.body.id;
      const now = Date.now();

      db.prepare(
        'INSERT INTO deploys (id, project_id, commit_sha, status, started_at) VALUES (?, ?, ?, ?, ?)',
      ).run('d1', projectId, 'abc123', 'success', now);

      db.prepare(
        'INSERT INTO deploys (id, project_id, commit_sha, status, started_at) VALUES (?, ?, ?, ?, ?)',
      ).run('d2', projectId, 'def456', 'pending', now + 1000);

      const res = await request(app)
        .get(`/api/projects/${projectId}/deploys`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('should return 404 for non-existent project', async () => {
      const res = await request(app)
        .get('/api/projects/non-existent-id/deploys')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
