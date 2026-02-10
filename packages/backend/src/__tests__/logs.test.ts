import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type Database from 'better-sqlite3';
import { createTestDb, createTestApp, getAuthToken } from './setup.js';

describe('Logs API', () => {
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
    db.exec('DELETE FROM logs');
    db.exec('DELETE FROM hosts');

    const now = Date.now();
    hostId = 'host-logs-test';
    db.prepare(
      'INSERT INTO hosts (id, name, type, ip_address, ssh_port, ssh_user, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(hostId, 'log-host', 'vm', '192.168.1.44', 22, 'root', now, now);
  });

  function insertLog(opts: { source?: string; level?: string; message?: string; container?: string; service?: string; timestamp?: number } = {}) {
    const now = Date.now();
    db.prepare(
      'INSERT INTO logs (host_id, source, container_name, service_name, level, message, timestamp, collected_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(
      hostId,
      opts.source ?? 'docker',
      opts.container ?? null,
      opts.service ?? null,
      opts.level ?? 'info',
      opts.message ?? 'Test log message',
      opts.timestamp ?? now,
      now,
    );
  }

  describe('GET /api/logs', () => {
    it('should return empty logs initially', async () => {
      const res = await request(app)
        .get('/api/logs')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.logs).toEqual([]);
      expect(res.body.total).toBe(0);
    });

    it('should return logs with pagination', async () => {
      for (let i = 0; i < 5; i++) {
        insertLog({ message: `Log ${i}`, timestamp: Date.now() + i });
      }

      const res = await request(app)
        .get('/api/logs?limit=2&offset=0')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.logs).toHaveLength(2);
      expect(res.body.total).toBe(5);
    });

    it('should filter by host_id', async () => {
      insertLog();
      // Insert log for different host
      const now = Date.now();
      db.prepare(
        'INSERT INTO hosts (id, name, type, ip_address, ssh_port, ssh_user, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ).run('other-host', 'other', 'vm', '10.0.0.1', 22, 'root', now, now);
      db.prepare(
        'INSERT INTO logs (host_id, source, level, message, timestamp, collected_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run('other-host', 'docker', 'info', 'Other log', now, now);

      const res = await request(app)
        .get(`/api/logs?host_id=${hostId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
    });

    it('should filter by level', async () => {
      insertLog({ level: 'error', message: 'Error log' });
      insertLog({ level: 'info', message: 'Info log' });

      const res = await request(app)
        .get('/api/logs?level=error')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.logs[0].level).toBe('error');
    });

    it('should filter by source', async () => {
      insertLog({ source: 'docker' });
      insertLog({ source: 'systemd' });

      const res = await request(app)
        .get('/api/logs?source=docker')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
    });

    it('should search by query', async () => {
      insertLog({ message: 'Container started successfully' });
      insertLog({ message: 'Connection refused error' });

      const res = await request(app)
        .get('/api/logs?q=error')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
    });

    it('should cap limit at 500', async () => {
      const res = await request(app)
        .get('/api/logs?limit=1000')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.limit).toBe(500);
    });
  });

  describe('GET /api/logs/hosts/:id', () => {
    it('should return logs for a specific host', async () => {
      insertLog({ message: 'Host-specific log' });

      const res = await request(app)
        .get(`/api/logs/hosts/${hostId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.logs).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('should filter by source and level', async () => {
      insertLog({ source: 'docker', level: 'error', message: 'docker err' });
      insertLog({ source: 'docker', level: 'info', message: 'docker info' });
      insertLog({ source: 'systemd', level: 'error', message: 'sys err' });

      const res = await request(app)
        .get(`/api/logs/hosts/${hostId}?source=docker&level=error`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.logs[0].message).toBe('docker err');
    });
  });
});
