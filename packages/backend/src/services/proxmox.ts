import db from '../db/connection.js';
import { decrypt } from './crypto.js';
import { config } from '../config.js';

interface ProxmoxNode {
  node: string;
  status: string;
  cpu: number;
  mem: number;
  maxmem: number;
  disk: number;
  maxdisk: number;
  uptime: number;
}

interface ProxmoxVM {
  vmid: number;
  name: string;
  status: string;
  cpu: number;
  mem: number;
  maxmem: number;
  disk: number;
  maxdisk: number;
  uptime: number;
  type: string;
}

interface ProxmoxVMStatus {
  status: string;
  cpu: number;
  mem: number;
  maxmem: number;
  disk: number;
  maxdisk: number;
  netin: number;
  netout: number;
  uptime: number;
}

interface SettingRow {
  key: string;
  value: string;
  updated_at: number;
}

function getProxmoxConfig(): { url: string; tokenId: string; tokenSecret: string } | null {
  const urlRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('proxmox_url') as SettingRow | undefined;
  const tokenIdRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('proxmox_token_id') as SettingRow | undefined;
  const tokenSecretRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('proxmox_token_secret') as SettingRow | undefined;

  if (!urlRow || !tokenIdRow || !tokenSecretRow) {
    return null;
  }

  const tokenSecret = decrypt(tokenSecretRow.value, config.jwtSecret);

  return {
    url: urlRow.value,
    tokenId: tokenIdRow.value,
    tokenSecret,
  };
}

async function proxmoxFetch<T>(path: string): Promise<T> {
  const cfg = getProxmoxConfig();
  if (!cfg) {
    throw new Error('Proxmox API not configured');
  }

  const url = `${cfg.url}${path}`;
  const prevTLS = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `PVEAPIToken=${cfg.tokenId}=${cfg.tokenSecret}`,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Proxmox API error ${res.status}: ${body}`);
    }

    const json = (await res.json()) as { data: T };
    return json.data;
  } finally {
    if (prevTLS === undefined) {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = prevTLS;
    }
  }
}

export async function getNodes(): Promise<ProxmoxNode[]> {
  return proxmoxFetch<ProxmoxNode[]>('/api2/json/nodes');
}

export async function getVMs(node: string): Promise<ProxmoxVM[]> {
  const [qemu, lxc] = await Promise.all([
    proxmoxFetch<ProxmoxVM[]>(`/api2/json/nodes/${encodeURIComponent(node)}/qemu`),
    proxmoxFetch<ProxmoxVM[]>(`/api2/json/nodes/${encodeURIComponent(node)}/lxc`),
  ]);

  const vms = qemu.map((vm) => ({ ...vm, type: 'vm' }));
  const cts = lxc.map((ct) => ({ ...ct, type: 'ct' }));

  return [...vms, ...cts];
}

export async function getVMStatus(node: string, vmid: number, type: string): Promise<ProxmoxVMStatus> {
  const resource = type === 'ct' ? 'lxc' : 'qemu';
  return proxmoxFetch<ProxmoxVMStatus>(
    `/api2/json/nodes/${encodeURIComponent(node)}/${resource}/${vmid}/status/current`,
  );
}

export async function testConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const cfg = getProxmoxConfig();
    if (!cfg) {
      return { success: false, message: 'Proxmox API not configured' };
    }

    const prevTLS = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    try {
      const res = await fetch(`${cfg.url}/api2/json/version`, {
        headers: {
          Authorization: `PVEAPIToken=${cfg.tokenId}=${cfg.tokenSecret}`,
        },
      });

      if (!res.ok) {
        return { success: false, message: `API returned ${res.status}` };
      }

      const json = (await res.json()) as { data: { version: string } };
      return { success: true, message: `Connected to Proxmox VE ${json.data.version}` };
    } finally {
      if (prevTLS === undefined) {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      } else {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = prevTLS;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, message };
  }
}
