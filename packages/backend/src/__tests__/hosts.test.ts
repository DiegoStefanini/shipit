import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type Database from 'better-sqlite3';
import { createTestDb, createTestApp, getAuthToken } from './setup.js';

describe('Hosts API', () => {
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
    db.exec('DELETE FROM metrics');
    db.exec('DELETE FROM logs');
    db.exec('DELETE FROM security_alerts');
    db.exec('DELETE FROM security_decisions');
    db.exec('DELETE FROM hosts');
  });

  const validHost = {
    name: 'docker-host',
    ip_address: '192.168.1.44',
  };

  describe('GET /api/hosts', () => {
    it('should return empty array initially', async () => {
      const res = await request(app)
        .get('/api/hosts')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return all hosts', async () => {
      await request(app)
        .post('/api/hosts')
        .set('Authorization', `Bearer ${token}`)
        .send(validHost);

      await request(app)
        .post('/api/hosts')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'web-host', ip_address: '192.168.1.45' });

      const res = await request(app)
        .get('/api/hosts')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });
  });

  describe('POST /api/hosts', () => {
    it('should create a host with minimal data', async () => {
      const res = await request(app)
        .post('/api/hosts')
        .set('Authorization', `Bearer ${token}`)
        .send(validHost);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('docker-host');
      expect(res.body.ip_address).toBe('192.168.1.44');
      expect(res.body.type).toBe('vm');
      expect(res.body.ssh_port).toBe(22);
      expect(res.body.ssh_user).toBe('root');
      expect(res.body.status).toBe('unknown');
    });

    it('should create a host with all fields', async () => {
      const res = await request(app)
        .post('/api/hosts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'full-host',
          type: 'ct',
          proxmox_vmid: 101,
          ip_address: '10.0.0.5',
          ssh_port: 2222,
          ssh_user: 'diego',
          ssh_key_path: '/home/diego/.ssh/id_ed25519',
          has_docker: true,
          has_crowdsec: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.type).toBe('ct');
      expect(res.body.proxmox_vmid).toBe(101);
      expect(res.body.ssh_port).toBe(2222);
      expect(res.body.ssh_user).toBe('diego');
      expect(res.body.has_docker).toBe(1);
      expect(res.body.has_crowdsec).toBe(1);
    });

    it('should reject missing name', async () => {
      const res = await request(app)
        .post('/api/hosts')
        .set('Authorization', `Bearer ${token}`)
        .send({ ip_address: '192.168.1.44' });

      expect(res.status).toBe(400);
    });

    it('should reject missing ip_address', async () => {
      const res = await request(app)
        .post('/api/hosts')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'host1' });

      expect(res.status).toBe(400);
    });

    it('should return 409 for duplicate name', async () => {
      await request(app)
        .post('/api/hosts')
        .set('Authorization', `Bearer ${token}`)
        .send(validHost);

      const res = await request(app)
        .post('/api/hosts')
        .set('Authorization', `Bearer ${token}`)
        .send(validHost);

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already exists/i);
    });
  });

  describe('GET /api/hosts/:id', () => {
    it('should return a host by id', async () => {
      const createRes = await request(app)
        .post('/api/hosts')
        .set('Authorization', `Bearer ${token}`)
        .send(validHost);

      const res = await request(app)
        .get(`/api/hosts/${createRes.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('docker-host');
    });

    it('should return 404 for non-existent host', async () => {
      const res = await request(app)
        .get('/api/hosts/non-existent-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/hosts/:id', () => {
    it('should update host fields', async () => {
      const createRes = await request(app)
        .post('/api/hosts')
        .set('Authorization', `Bearer ${token}`)
        .send(validHost);

      const res = await request(app)
        .patch(`/api/hosts/${createRes.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ip_address: '10.0.0.1', ssh_port: 2222 });

      expect(res.status).toBe(200);
      expect(res.body.ip_address).toBe('10.0.0.1');
      expect(res.body.ssh_port).toBe(2222);
    });

    it('should update boolean fields', async () => {
      const createRes = await request(app)
        .post('/api/hosts')
        .set('Authorization', `Bearer ${token}`)
        .send(validHost);

      const res = await request(app)
        .patch(`/api/hosts/${createRes.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ has_docker: true, has_crowdsec: true });

      expect(res.status).toBe(200);
      expect(res.body.has_docker).toBe(1);
      expect(res.body.has_crowdsec).toBe(1);
    });

    it('should return existing host if no fields sent', async () => {
      const createRes = await request(app)
        .post('/api/hosts')
        .set('Authorization', `Bearer ${token}`)
        .send(validHost);

      const res = await request(app)
        .patch(`/api/hosts/${createRes.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('docker-host');
    });

    it('should return 404 for non-existent host', async () => {
      const res = await request(app)
        .patch('/api/hosts/non-existent-id')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'test' });

      expect(res.status).toBe(404);
    });

    it('should return 409 on duplicate name update', async () => {
      await request(app)
        .post('/api/hosts')
        .set('Authorization', `Bearer ${token}`)
        .send(validHost);

      const createRes2 = await request(app)
        .post('/api/hosts')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'other-host', ip_address: '10.0.0.2' });

      const res = await request(app)
        .patch(`/api/hosts/${createRes2.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'docker-host' });

      expect(res.status).toBe(409);
    });
  });

  describe('DELETE /api/hosts/:id', () => {
    it('should delete an existing host', async () => {
      const createRes = await request(app)
        .post('/api/hosts')
        .set('Authorization', `Bearer ${token}`)
        .send(validHost);

      const delRes = await request(app)
        .delete(`/api/hosts/${createRes.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(delRes.status).toBe(204);

      const getRes = await request(app)
        .get(`/api/hosts/${createRes.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(getRes.status).toBe(404);
    });

    it('should return 404 for non-existent host', async () => {
      const res = await request(app)
        .delete('/api/hosts/non-existent-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
