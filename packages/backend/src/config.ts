export const config = {
  port: parseInt(process.env.PORT ?? '3001'),
  dataDir: process.env.DATA_DIR ?? '/data',
  dockerNetwork: process.env.DOCKER_NETWORK ?? 'shipit-net',
  giteaUrl: process.env.GITEA_URL ?? 'http://192.168.1.44:3000',
  buildsDir: process.env.BUILDS_DIR ?? '/tmp/shipit-builds',
  version: '0.1.0',
  jwtSecret: process.env.JWT_SECRET ?? 'shipit-dev-secret-change-me',
  adminUser: process.env.ADMIN_USER ?? 'admin',
  adminPassword: process.env.ADMIN_PASSWORD ?? 'shipit',
  webhookSecret: process.env.WEBHOOK_SECRET ?? 'gitea-webhook-secret',
  giteaToken: process.env.GITEA_TOKEN ?? '',
  externalUrl: process.env.EXTERNAL_URL ?? 'https://deploy.stefaniniserver.com',
};
