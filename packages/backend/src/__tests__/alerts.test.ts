import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type Database from 'better-sqlite3';
import { createTestDb, createTestApp, getAuthToken } from './setup.js';

describe('Alerts API', () => {
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
    db.exec('DELETE FROM alert_history');
    db.exec('DELETE FROM alert_rules');
    db.exec('DELETE FROM notification_channels');
  });

  // --- Notification Channels ---

  describe('Notification Channels', () => {
    const validChannel = {
      name: 'Discord Alerts',
      type: 'discord',
      config: { webhook_url: 'https://discord.com/api/webhooks/123/abc' },
    };

    describe('GET /api/alerts/channels', () => {
      it('should return empty array initially', async () => {
        const res = await request(app)
          .get('/api/alerts/channels')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
      });
    });

    describe('POST /api/alerts/channels', () => {
      it('should create a channel', async () => {
        const res = await request(app)
          .post('/api/alerts/channels')
          .set('Authorization', `Bearer ${token}`)
          .send(validChannel);

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body.name).toBe('Discord Alerts');
        expect(res.body.type).toBe('discord');
        expect(res.body.enabled).toBe(1);
      });

      it('should store config as JSON string', async () => {
        const res = await request(app)
          .post('/api/alerts/channels')
          .set('Authorization', `Bearer ${token}`)
          .send(validChannel);

        expect(res.status).toBe(201);
        const parsed = JSON.parse(res.body.config);
        expect(parsed).toHaveProperty('webhook_url');
      });

      it('should reject missing name', async () => {
        const res = await request(app)
          .post('/api/alerts/channels')
          .set('Authorization', `Bearer ${token}`)
          .send({ type: 'discord', config: {} });

        expect(res.status).toBe(400);
      });

      it('should reject missing type', async () => {
        const res = await request(app)
          .post('/api/alerts/channels')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'test', config: {} });

        expect(res.status).toBe(400);
      });

      it('should reject missing config', async () => {
        const res = await request(app)
          .post('/api/alerts/channels')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'test', type: 'discord' });

        expect(res.status).toBe(400);
      });
    });

    describe('PATCH /api/alerts/channels/:id', () => {
      it('should update channel fields', async () => {
        const createRes = await request(app)
          .post('/api/alerts/channels')
          .set('Authorization', `Bearer ${token}`)
          .send(validChannel);

        const res = await request(app)
          .patch(`/api/alerts/channels/${createRes.body.id}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'Updated Channel', enabled: false });

        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Updated Channel');
        expect(res.body.enabled).toBe(0);
      });

      it('should return 404 for non-existent channel', async () => {
        const res = await request(app)
          .patch('/api/alerts/channels/non-existent')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'test' });

        expect(res.status).toBe(404);
      });
    });

    describe('DELETE /api/alerts/channels/:id', () => {
      it('should delete an existing channel', async () => {
        const createRes = await request(app)
          .post('/api/alerts/channels')
          .set('Authorization', `Bearer ${token}`)
          .send(validChannel);

        const delRes = await request(app)
          .delete(`/api/alerts/channels/${createRes.body.id}`)
          .set('Authorization', `Bearer ${token}`);

        expect(delRes.status).toBe(200);
        expect(delRes.body.success).toBe(true);
      });

      it('should return 404 for non-existent channel', async () => {
        const res = await request(app)
          .delete('/api/alerts/channels/non-existent')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(404);
      });
    });
  });

  // --- Alert Rules ---

  describe('Alert Rules', () => {
    const validRule = {
      name: 'High CPU Alert',
      type: 'threshold',
      condition: { metric: 'cpu', operator: '>', value: 90 },
      channel_ids: ['ch-1'],
    };

    describe('GET /api/alerts/rules', () => {
      it('should return empty array initially', async () => {
        const res = await request(app)
          .get('/api/alerts/rules')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
      });
    });

    describe('POST /api/alerts/rules', () => {
      it('should create a rule', async () => {
        const res = await request(app)
          .post('/api/alerts/rules')
          .set('Authorization', `Bearer ${token}`)
          .send(validRule);

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body.name).toBe('High CPU Alert');
        expect(res.body.type).toBe('threshold');
        expect(res.body.cooldown).toBe(300);
        expect(res.body.enabled).toBe(1);
      });

      it('should accept custom cooldown', async () => {
        const res = await request(app)
          .post('/api/alerts/rules')
          .set('Authorization', `Bearer ${token}`)
          .send({ ...validRule, cooldown: 600 });

        expect(res.status).toBe(201);
        expect(res.body.cooldown).toBe(600);
      });

      it('should reject missing name', async () => {
        const res = await request(app)
          .post('/api/alerts/rules')
          .set('Authorization', `Bearer ${token}`)
          .send({ type: 'threshold', condition: {}, channel_ids: [] });

        expect(res.status).toBe(400);
      });

      it('should reject missing type', async () => {
        const res = await request(app)
          .post('/api/alerts/rules')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'test', condition: {}, channel_ids: [] });

        expect(res.status).toBe(400);
      });

      it('should reject missing condition', async () => {
        const res = await request(app)
          .post('/api/alerts/rules')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'test', type: 'threshold', channel_ids: [] });

        expect(res.status).toBe(400);
      });

      it('should reject missing channel_ids', async () => {
        const res = await request(app)
          .post('/api/alerts/rules')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'test', type: 'threshold', condition: {} });

        expect(res.status).toBe(400);
      });
    });

    describe('PATCH /api/alerts/rules/:id', () => {
      it('should update rule fields', async () => {
        const createRes = await request(app)
          .post('/api/alerts/rules')
          .set('Authorization', `Bearer ${token}`)
          .send(validRule);

        const res = await request(app)
          .patch(`/api/alerts/rules/${createRes.body.id}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'Updated Rule', enabled: false, cooldown: 120 });

        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Updated Rule');
        expect(res.body.enabled).toBe(0);
        expect(res.body.cooldown).toBe(120);
      });

      it('should return 404 for non-existent rule', async () => {
        const res = await request(app)
          .patch('/api/alerts/rules/non-existent')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'test' });

        expect(res.status).toBe(404);
      });
    });

    describe('DELETE /api/alerts/rules/:id', () => {
      it('should delete an existing rule', async () => {
        const createRes = await request(app)
          .post('/api/alerts/rules')
          .set('Authorization', `Bearer ${token}`)
          .send(validRule);

        const delRes = await request(app)
          .delete(`/api/alerts/rules/${createRes.body.id}`)
          .set('Authorization', `Bearer ${token}`);

        expect(delRes.status).toBe(200);
        expect(delRes.body.success).toBe(true);
      });

      it('should return 404 for non-existent rule', async () => {
        const res = await request(app)
          .delete('/api/alerts/rules/non-existent')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(404);
      });
    });
  });

  // --- Alert History ---

  describe('Alert History', () => {
    describe('GET /api/alerts/history', () => {
      it('should return empty history', async () => {
        const res = await request(app)
          .get('/api/alerts/history')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.history).toEqual([]);
        expect(res.body.total).toBe(0);
      });

      it('should return history with pagination', async () => {
        const now = Date.now();
        for (let i = 0; i < 5; i++) {
          db.prepare('INSERT INTO alert_history (rule_name, message, triggered_at) VALUES (?, ?, ?)')
            .run(`rule-${i}`, `Alert message ${i}`, now + i);
        }

        const res = await request(app)
          .get('/api/alerts/history?limit=2&offset=0')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.history).toHaveLength(2);
        expect(res.body.total).toBe(5);
        expect(res.body.limit).toBe(2);
        expect(res.body.offset).toBe(0);
      });

      it('should respect offset', async () => {
        const now = Date.now();
        for (let i = 0; i < 5; i++) {
          db.prepare('INSERT INTO alert_history (rule_name, message, triggered_at) VALUES (?, ?, ?)')
            .run(`rule-${i}`, `Alert message ${i}`, now + i);
        }

        const res = await request(app)
          .get('/api/alerts/history?limit=10&offset=3')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.history).toHaveLength(2);
        expect(res.body.offset).toBe(3);
      });

      it('should cap limit at 200', async () => {
        const res = await request(app)
          .get('/api/alerts/history?limit=500')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.limit).toBe(200);
      });
    });
  });
});
