import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type Database from 'better-sqlite3';
import { createTestDb, createTestApp, getAuthToken } from './setup.js';

describe('Security API', () => {
  let app: Express;
  let db: Database.Database;
  let token: string;
  let hostId: string;

  beforeAll(() => {
    db = createTestDb();
    app = createTestApp(db);
    token = getAuthToken();
  });

  afterAll(() => {
    db.close();
  });

  beforeEach(() => {
    db.exec('DELETE FROM security_alerts');
    db.exec('DELETE FROM security_decisions');
    db.exec('DELETE FROM hosts');

    const now = Date.now();
    hostId = 'host-sec-test';
    db.prepare(
      'INSERT INTO hosts (id, name, type, ip_address, ssh_port, ssh_user, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(hostId, 'sec-host', 'vm', '192.168.1.44', 22, 'root', now, now);
  });

  describe('GET /api/security/overview', () => {
    it('should return security overview', async () => {
      const res = await request(app)
        .get('/api/security/overview')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total_alerts_24h');
      expect(res.body).toHaveProperty('active_decisions');
      expect(res.body).toHaveProperty('top_scenarios');
      expect(res.body).toHaveProperty('top_countries');
      expect(res.body).toHaveProperty('alerts_per_hour');
    });

    it('should count alerts from last 24h', async () => {
      const now = Date.now();
      const recentTime = now - 3600_000; // 1h ago
      const oldTime = now - 48 * 3600_000; // 48h ago

      // Recent alert
      db.prepare(
        'INSERT INTO security_alerts (host_id, scenario, source_ip, collected_at) VALUES (?, ?, ?, ?)',
      ).run(hostId, 'ssh-brute', '10.0.0.1', recentTime);

      // Old alert (should not count)
      db.prepare(
        'INSERT INTO security_alerts (host_id, scenario, source_ip, collected_at) VALUES (?, ?, ?, ?)',
      ).run(hostId, 'ssh-brute', '10.0.0.2', oldTime);

      const res = await request(app)
        .get('/api/security/overview')
        .set('Authorization', `Bearer ${token}`);

      expect(res.body.total_alerts_24h).toBe(1);
    });

    it('should return top scenarios', async () => {
      const now = Date.now();
      db.prepare(
        'INSERT INTO security_alerts (host_id, scenario, source_ip, collected_at) VALUES (?, ?, ?, ?)',
      ).run(hostId, 'ssh-brute', '10.0.0.1', now);
      db.prepare(
        'INSERT INTO security_alerts (host_id, scenario, source_ip, collected_at) VALUES (?, ?, ?, ?)',
      ).run(hostId, 'ssh-brute', '10.0.0.2', now);
      db.prepare(
        'INSERT INTO security_alerts (host_id, scenario, source_ip, collected_at) VALUES (?, ?, ?, ?)',
      ).run(hostId, 'http-probe', '10.0.0.3', now);

      const res = await request(app)
        .get('/api/security/overview')
        .set('Authorization', `Bearer ${token}`);

      expect(res.body.top_scenarios).toHaveLength(2);
      expect(res.body.top_scenarios[0].scenario).toBe('ssh-brute');
      expect(res.body.top_scenarios[0].count).toBe(2);
    });
  });

  describe('GET /api/security/alerts', () => {
    it('should return empty alerts initially', async () => {
      const res = await request(app)
        .get('/api/security/alerts')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.alerts).toEqual([]);
      expect(res.body.total).toBe(0);
    });

    it('should return alerts with pagination', async () => {
      const now = Date.now();
      for (let i = 0; i < 5; i++) {
        db.prepare(
          'INSERT INTO security_alerts (host_id, scenario, source_ip, collected_at) VALUES (?, ?, ?, ?)',
        ).run(hostId, 'ssh-brute', `10.0.0.${i}`, now + i);
      }

      const res = await request(app)
        .get('/api/security/alerts?limit=2')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.alerts).toHaveLength(2);
      expect(res.body.total).toBe(5);
    });

    it('should filter by host_id', async () => {
      const now = Date.now();
      db.prepare(
        'INSERT INTO security_alerts (host_id, scenario, source_ip, collected_at) VALUES (?, ?, ?, ?)',
      ).run(hostId, 'ssh-brute', '10.0.0.1', now);

      // Different host
      db.prepare(
        'INSERT INTO hosts (id, name, type, ip_address, ssh_port, ssh_user, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ).run('other-host', 'other', 'vm', '10.0.0.2', 22, 'root', now, now);
      db.prepare(
        'INSERT INTO security_alerts (host_id, scenario, source_ip, collected_at) VALUES (?, ?, ?, ?)',
      ).run('other-host', 'http-probe', '10.0.0.3', now);

      const res = await request(app)
        .get(`/api/security/alerts?host_id=${hostId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.body.total).toBe(1);
      expect(res.body.alerts[0].scenario).toBe('ssh-brute');
    });
  });

  describe('GET /api/security/decisions', () => {
    it('should return empty decisions initially', async () => {
      const res = await request(app)
        .get('/api/security/decisions')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return decisions', async () => {
      const now = Date.now();
      db.prepare(
        'INSERT INTO security_decisions (host_id, source_ip, type, scenario, duration, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(hostId, '10.0.0.1', 'ban', 'ssh-brute', '24h', now);

      const res = await request(app)
        .get('/api/security/decisions')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].source_ip).toBe('10.0.0.1');
      expect(res.body[0].type).toBe('ban');
    });

    it('should filter by host_id', async () => {
      const now = Date.now();
      db.prepare(
        'INSERT INTO security_decisions (host_id, source_ip, type, created_at) VALUES (?, ?, ?, ?)',
      ).run(hostId, '10.0.0.1', 'ban', now);

      db.prepare(
        'INSERT INTO hosts (id, name, type, ip_address, ssh_port, ssh_user, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ).run('other-host-2', 'other2', 'vm', '10.0.0.99', 22, 'root', now, now);
      db.prepare(
        'INSERT INTO security_decisions (host_id, source_ip, type, created_at) VALUES (?, ?, ?, ?)',
      ).run('other-host-2', '10.0.0.2', 'ban', now);

      const res = await request(app)
        .get(`/api/security/decisions?host_id=${hostId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].source_ip).toBe('10.0.0.1');
    });
  });
});
