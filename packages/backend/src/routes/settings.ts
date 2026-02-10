import { Router, Request, Response } from 'express';
import db from '../db/connection.js';
import { encrypt, decrypt } from '../services/crypto.js';
import { config } from '../config.js';
import * as proxmox from '../services/proxmox.js';

const router = Router();

interface SettingRow {
  key: string;
  value: string;
  updated_at: number;
}

// GET /api/settings/proxmox
router.get('/proxmox', (_req: Request, res: Response) => {
  const urlRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('proxmox_url') as SettingRow | undefined;
  const tokenIdRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('proxmox_token_id') as SettingRow | undefined;
  const tokenSecretRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('proxmox_token_secret') as SettingRow | undefined;

  if (!urlRow || !tokenIdRow) {
    res.json({ configured: false, url: null, tokenId: null, tokenSecret: null });
    return;
  }

  let maskedSecret: string | null = null;
  if (tokenSecretRow) {
    try {
      const secret = decrypt(tokenSecretRow.value, config.jwtSecret);
      maskedSecret = secret.slice(0, 8) + '****';
    } catch {
      maskedSecret = '****';
    }
  }

  res.json({
    configured: true,
    url: urlRow.value,
    tokenId: tokenIdRow.value,
    tokenSecret: maskedSecret,
  });
});

// PUT /api/settings/proxmox
router.put('/proxmox', (req: Request, res: Response) => {
  const { url, tokenId, tokenSecret } = req.body;

  if (!url || !tokenId || !tokenSecret) {
    res.status(400).json({ error: 'url, tokenId, and tokenSecret are required' });
    return;
  }

  const now = Date.now();
  const encryptedSecret = encrypt(tokenSecret, config.jwtSecret);

  const upsert = db.prepare(
    'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
  );

  const transaction = db.transaction(() => {
    upsert.run('proxmox_url', url, now);
    upsert.run('proxmox_token_id', tokenId, now);
    upsert.run('proxmox_token_secret', encryptedSecret, now);
  });

  transaction();

  res.json({ message: 'Proxmox settings saved' });
});

// POST /api/settings/proxmox/test
router.post('/proxmox/test', async (_req: Request, res: Response) => {
  const result = await proxmox.testConnection();
  res.json(result);
});

export default router;
