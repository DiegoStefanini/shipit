export const config = {
  port: parseInt(process.env.PORT ?? '3001'),
  dataDir: process.env.DATA_DIR ?? '/data',
  dockerNetwork: process.env.DOCKER_NETWORK ?? 'shipit-net',
  giteaUrl: process.env.GITEA_URL ?? 'http://192.168.1.44:3000',
  buildsDir: process.env.BUILDS_DIR ?? '/tmp/shipit-builds',
  version: '0.1.0',
};
