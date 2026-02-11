import { z } from 'zod';
import { logger } from './logger.js';

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATA_DIR: z.string().default('/var/lib/shipit'),
  GITEA_URL: z.string().url().default('http://localhost:3000'),
  JWT_SECRET: z.string().min(1).default('change-me-in-production'),
  ADMIN_USER: z.string().min(1).default('admin'),
  ADMIN_PASSWORD: z.string().min(1).default('changeme'),
  WEBHOOK_SECRET: z.string().default('change-me-webhook-secret'),
  GITEA_TOKEN: z.string().default(''),
  BASE_DOMAIN: z.string().default('localhost'),
  DASHBOARD_DOMAIN: z.string().default('localhost'),
  SELF_REPO: z.string().default(''),
  SELF_DEPLOY_ENABLED: z.string().default('false'),
});

const parsed = envSchema.parse(process.env);

export const config = {
  port: parsed.PORT,
  dataDir: parsed.DATA_DIR,
  giteaUrl: parsed.GITEA_URL,
  version: '0.2.0',
  jwtSecret: parsed.JWT_SECRET,
  adminUser: parsed.ADMIN_USER,
  adminPassword: parsed.ADMIN_PASSWORD,
  webhookSecret: parsed.WEBHOOK_SECRET,
  giteaToken: parsed.GITEA_TOKEN,
  baseDomain: parsed.BASE_DOMAIN,
  dashboardDomain: parsed.DASHBOARD_DOMAIN,
  selfRepo: parsed.SELF_REPO,
  selfDeployEnabled: parsed.SELF_DEPLOY_ENABLED === 'true',
};

// Warn on insecure defaults
if (config.jwtSecret === 'change-me-in-production') {
  logger.warn('Using default JWT_SECRET — change in production!');
}
if (config.adminPassword === 'changeme') {
  logger.warn('Using default ADMIN_PASSWORD — change in production!');
}
