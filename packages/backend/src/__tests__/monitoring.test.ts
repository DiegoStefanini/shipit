import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type Database from 'better-sqlite3';
import { createTestDb, createTestApp, getAuthToken } from './setup.js';

describe('Monitoring API', () => {
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
    db.exec('DELETE FROM metrics');
    db.exec('DELETE FROM hosts');

    // Create a test host
    const now = Date.now();
    hostId = 'host-monitor-test';
    db.prepare(
      'INSERT INTO hosts (id, name, type, ip_address, ssh_port, ssh_user, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(hostId, 'test-host', 'vm', '192.168.1.44', 22, 'root', 'online', now, now);
  });

  describe('GET /api/monitoring/overview', () => {
    it('should return overview for all hosts', async () => {
      const res = await request(app)
        .get('/api/monitoring/overview')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].host_id).toBe(hostId);
      expect(res.body[0].host_name).toBe('test-host');
      expect(res.body[0]).toHaveProperty('metrics');
    });

    it('should include latest metrics in overview', async () => {
      const now = Date.now();
      db.prepare(
        'INSERT INTO metrics (host_id, source, metric_name, metric_value, collected_at) VALUES (?, ?, ?, ?, ?)',
      ).run(hostId, 'proxmox', 'cpu', 45.5, now);
      db.prepare(
        'INSERT INTO metrics (host_id, source, metric_name, metric_value, collected_at) VALUES (?, ?, ?, ?, ?)',
      ).run(hostId, 'proxmox', 'memory', 72.3, now);

      const res = await request(app)
        .get('/api/monitoring/overview')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body[0].metrics.cpu).toBe(45.5);
      expect(res.body[0].metrics.memory).toBe(72.3);
    });
  });

  describe('GET /api/monitoring/hosts/:id', () => {
    it('should return time series metrics for a host', async () => {
      const now = Date.now();
      const from = now - 3600_000;

      // Insert some metrics
      for (let i = 0; i < 5; i++) {
        db.prepare(
          'INSERT INTO metrics (host_id, source, metric_name, metric_value, collected_at) VALUES (?, ?, ?, ?, ?)',
        ).run(hostId, 'proxmox', 'cpu', 40 + i * 5, from + i * 600_000);
      }

      const res = await request(app)
        .get(`/api/monitoring/hosts/${hostId}?from=${from}&to=${now}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.host_id).toBe(hostId);
      expect(res.body.series).toHaveProperty('cpu');
      expect(res.body.series.cpu).toHaveLength(5);
    });

    it('should return 404 for non-existent host', async () => {
      const res = await request(app)
        .get('/api/monitoring/hosts/non-existent')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/monitoring/hosts/:id/containers', () => {
    it('should return container metrics', async () => {
      const now = Date.now();
      db.prepare(
        'INSERT INTO metrics (host_id, source, metric_name, metric_value, container_name, collected_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(hostId, 'docker', 'cpu_percent', 12.5, 'nginx', now);
      db.prepare(
        'INSERT INTO metrics (host_id, source, metric_name, metric_value, container_name, collected_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(hostId, 'docker', 'mem_usage', 256.0, 'nginx', now);

      const res = await request(app)
        .get(`/api/monitoring/hosts/${hostId}/containers`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.host_id).toBe(hostId);
      expect(res.body.containers).toHaveProperty('nginx');
      expect(res.body.containers.nginx.cpu_percent).toBe(12.5);
      expect(res.body.containers.nginx.mem_usage).toBe(256.0);
    });

    it('should return 404 for non-existent host', async () => {
      const res = await request(app)
        .get('/api/monitoring/hosts/non-existent/containers')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('should return empty containers when no Docker metrics', async () => {
      const res = await request(app)
        .get(`/api/monitoring/hosts/${hostId}/containers`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.containers).toEqual({});
    });
  });
});
