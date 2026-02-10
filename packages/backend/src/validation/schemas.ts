import { z } from 'zod';

// --- Auth ---

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

// --- Projects ---

export const createProjectSchema = z.object({
  name: z.string().regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/, 'name must be lowercase alphanumeric with hyphens only'),
  gitea_repo: z.string().min(1, 'gitea_repo is required'),
  gitea_url: z.string().url('gitea_url must be a valid URL'),
  branch: z.string().optional().default('main'),
  host_id: z.string().uuid().optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/, 'name must be lowercase alphanumeric with hyphens only').optional(),
  branch: z.string().optional(),
  env_vars: z.union([z.string(), z.record(z.string(), z.string())]).optional(),
  host_id: z.string().uuid().nullable().optional(),
});

// --- Hosts ---

export const createHostSchema = z.object({
  name: z.string().min(1, 'name is required'),
  type: z.enum(['vm', 'ct']).optional().default('vm'),
  proxmox_vmid: z.number().int().positive().optional(),
  ip_address: z.string().ipv4('ip_address must be a valid IP address'),
  ssh_port: z.number().int().min(1).max(65535).optional().default(22),
  ssh_user: z.string().optional().default('root'),
  ssh_key_path: z.string().optional(),
  has_docker: z.union([z.boolean(), z.literal(0), z.literal(1)]).optional().default(false),
  has_crowdsec: z.union([z.boolean(), z.literal(0), z.literal(1)]).optional().default(false),
});

export const updateHostSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['vm', 'ct']).optional(),
  proxmox_vmid: z.number().int().positive().nullable().optional(),
  ip_address: z.string().ipv4().optional(),
  ssh_port: z.number().int().min(1).max(65535).optional(),
  ssh_user: z.string().optional(),
  ssh_key_path: z.string().nullable().optional(),
  has_docker: z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
  has_crowdsec: z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
  poll_interval: z.number().int().positive().optional(),
});

// --- Settings ---

export const proxmoxSettingsSchema = z.object({
  url: z.string().url('url must be a valid URL'),
  tokenId: z.string().min(1, 'tokenId is required'),
  tokenSecret: z.string().min(1, 'tokenSecret is required'),
});

// --- Alerts ---

export const createChannelSchema = z.object({
  name: z.string().min(1, 'name is required'),
  type: z.enum(['telegram', 'discord']),
  config: z.record(z.string(), z.unknown()),
});

export const updateChannelSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['telegram', 'discord']).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  enabled: z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
});

export const createRuleSchema = z.object({
  name: z.string().min(1, 'name is required'),
  type: z.enum(['metric_threshold', 'service_down', 'security', 'deploy']),
  condition: z.union([z.string(), z.record(z.string(), z.unknown())]),
  channel_ids: z.union([z.string(), z.array(z.string())]),
  cooldown: z.number().int().positive().optional().default(300),
});

export const updateRuleSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['metric_threshold', 'service_down', 'security', 'deploy']).optional(),
  condition: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  channel_ids: z.union([z.string(), z.array(z.string())]).optional(),
  cooldown: z.number().int().positive().optional(),
  enabled: z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
});

// --- Security ---

export const blockIPSchema = z.object({
  host_id: z.string().min(1, 'host_id is required'),
  ip: z.string().min(1, 'ip is required'),
  duration: z.string().optional(),
  reason: z.string().optional(),
});

export const unblockIPSchema = z.object({
  host_id: z.string().min(1, 'host_id is required'),
  ip: z.string().min(1, 'ip is required'),
});
