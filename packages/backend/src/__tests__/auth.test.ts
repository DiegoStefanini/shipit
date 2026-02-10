import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type Database from 'better-sqlite3';
import { createTestDb, createTestApp, getAuthToken } from './setup.js';

describe('Auth API', () => {
  let app: Express;
  let db: Database.Database;

  beforeAll(() => {
    db = createTestDb();
    app = createTestApp(db);
  });

  afterAll(() => {
    db.close();
  });

  describe('POST /api/auth/login', () => {
    it('should return a token with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'testpass123' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(typeof res.body.token).toBe('string');
    });

    it('should reject invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'wrongpass' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('should reject invalid username', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'nobody', password: 'testpass123' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('should return 400 if username is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'testpass123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/[Uu]sername/);
    });

    it('should return 400 if password is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/[Pp]assword/);
    });

    it('should return 400 if body is empty', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return the current user with valid token', async () => {
      const token = getAuthToken();
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ username: 'admin' });
    });

    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token-here');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('should return 401 with malformed authorization header', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'NotBearer token');

      expect(res.status).toBe(401);
    });
  });

  describe('Protected routes require auth', () => {
    it('should reject unauthenticated access to /api/projects', async () => {
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(401);
    });

    it('should reject unauthenticated access to /api/hosts', async () => {
      const res = await request(app).get('/api/hosts');
      expect(res.status).toBe(401);
    });

    it('should reject unauthenticated access to /api/settings/proxmox', async () => {
      const res = await request(app).get('/api/settings/proxmox');
      expect(res.status).toBe(401);
    });

    it('should reject unauthenticated access to /api/alerts/channels', async () => {
      const res = await request(app).get('/api/alerts/channels');
      expect(res.status).toBe(401);
    });
  });
});

describe('Health & Config endpoints', () => {
  let app: Express;
  let db: Database.Database;

  beforeAll(() => {
    db = createTestDb();
    app = createTestApp(db);
  });

  afterAll(() => {
    db.close();
  });

  it('GET /api/health should return ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('GET /api/config should return configuration', async () => {
    const res = await request(app).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('baseDomain');
    expect(res.body).toHaveProperty('giteaUrl');
  });
});
