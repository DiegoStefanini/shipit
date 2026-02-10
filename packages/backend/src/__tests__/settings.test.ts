import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type Database from 'better-sqlite3';
import { createTestDb, createTestApp, getAuthToken } from './setup.js';

describe('Settings API', () => {
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
    db.exec('DELETE FROM settings');
  });

  describe('GET /api/settings/proxmox', () => {
    it('should return unconfigured when no settings exist', async () => {
      const res = await request(app)
        .get('/api/settings/proxmox')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.configured).toBe(false);
      expect(res.body.url).toBeNull();
      expect(res.body.tokenId).toBeNull();
      expect(res.body.tokenSecret).toBeNull();
    });

    it('should return configured settings after saving', async () => {
      // Save settings first
      await request(app)
        .put('/api/settings/proxmox')
        .set('Authorization', `Bearer ${token}`)
        .send({
          url: 'https://192.168.1.150:8006',
          tokenId: 'root@pam!shipit',
          tokenSecret: 'super-secret-token-12345678',
        });

      const res = await request(app)
        .get('/api/settings/proxmox')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.configured).toBe(true);
      expect(res.body.url).toBe('https://192.168.1.150:8006');
      expect(res.body.tokenId).toBe('root@pam!shipit');
      // Token secret should be masked
      expect(res.body.tokenSecret).toContain('****');
      expect(res.body.tokenSecret).not.toBe('super-secret-token-12345678');
    });
  });

  describe('PUT /api/settings/proxmox', () => {
    it('should save proxmox settings', async () => {
      const res = await request(app)
        .put('/api/settings/proxmox')
        .set('Authorization', `Bearer ${token}`)
        .send({
          url: 'https://192.168.1.150:8006',
          tokenId: 'root@pam!shipit',
          tokenSecret: 'my-secret-token',
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/saved/i);
    });

    it('should update existing settings (upsert)', async () => {
      await request(app)
        .put('/api/settings/proxmox')
        .set('Authorization', `Bearer ${token}`)
        .send({
          url: 'https://old.host:8006',
          tokenId: 'old-token',
          tokenSecret: 'old-secret',
        });

      await request(app)
        .put('/api/settings/proxmox')
        .set('Authorization', `Bearer ${token}`)
        .send({
          url: 'https://new.host:8006',
          tokenId: 'new-token',
          tokenSecret: 'new-secret',
        });

      const res = await request(app)
        .get('/api/settings/proxmox')
        .set('Authorization', `Bearer ${token}`);

      expect(res.body.url).toBe('https://new.host:8006');
      expect(res.body.tokenId).toBe('new-token');
    });

    it('should reject missing url', async () => {
      const res = await request(app)
        .put('/api/settings/proxmox')
        .set('Authorization', `Bearer ${token}`)
        .send({ tokenId: 'test', tokenSecret: 'test' });

      expect(res.status).toBe(400);
    });

    it('should reject missing tokenId', async () => {
      const res = await request(app)
        .put('/api/settings/proxmox')
        .set('Authorization', `Bearer ${token}`)
        .send({ url: 'https://host:8006', tokenSecret: 'test' });

      expect(res.status).toBe(400);
    });

    it('should reject missing tokenSecret', async () => {
      const res = await request(app)
        .put('/api/settings/proxmox')
        .set('Authorization', `Bearer ${token}`)
        .send({ url: 'https://host:8006', tokenId: 'test' });

      expect(res.status).toBe(400);
    });

    it('should encrypt the token secret in the database', async () => {
      await request(app)
        .put('/api/settings/proxmox')
        .set('Authorization', `Bearer ${token}`)
        .send({
          url: 'https://192.168.1.150:8006',
          tokenId: 'root@pam!shipit',
          tokenSecret: 'plaintext-secret',
        });

      // Read raw value from DB
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('proxmox_token_secret') as { value: string };
      // Should be base64 encoded encrypted value, not plaintext
      expect(row.value).not.toBe('plaintext-secret');
      expect(row.value.length).toBeGreaterThan(20);
    });
  });
});
