#!/usr/bin/env bash
set -e

INSTALL_DIR=/opt/shipit
BACKUP_DIR=/opt/shipit/backup
HEALTH_URL="http://127.0.0.1:3001/api/health"
MAX_RETRIES=5
RETRY_INTERVAL=3

cd "$INSTALL_DIR"

echo "[self-deploy] Starting self-deploy..."

# Save current commit hash
CURRENT_COMMIT=$(git rev-parse HEAD)
echo "[self-deploy] Current commit: $CURRENT_COMMIT"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup current dist directories
echo "[self-deploy] Backing up current build..."
rm -rf "$BACKUP_DIR/backend-dist" "$BACKUP_DIR/frontend-dist"
if [ -d packages/backend/dist ]; then
  cp -r packages/backend/dist "$BACKUP_DIR/backend-dist"
fi
if [ -d packages/frontend/dist ]; then
  cp -r packages/frontend/dist "$BACKUP_DIR/frontend-dist"
fi
echo "$CURRENT_COMMIT" > "$BACKUP_DIR/commit-hash"

# Pull latest code
echo "[self-deploy] Pulling latest code..."
git pull origin main

# Install dependencies
echo "[self-deploy] Installing dependencies..."
npm ci --workspaces

# Build backend and frontend
echo "[self-deploy] Building backend..."
npm run build -w packages/backend

echo "[self-deploy] Building frontend..."
npm run build -w packages/frontend

# Restart service
echo "[self-deploy] Restarting shipit service..."
sudo systemctl restart shipit

# Health check with retries
echo "[self-deploy] Running health check..."
HEALTHY=false
for i in $(seq 1 $MAX_RETRIES); do
  sleep $RETRY_INTERVAL
  if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
    HEALTHY=true
    echo "[self-deploy] Health check passed (attempt $i/$MAX_RETRIES)"
    break
  fi
  echo "[self-deploy] Health check failed (attempt $i/$MAX_RETRIES)"
done

if [ "$HEALTHY" = true ]; then
  echo "[self-deploy] Deploy successful!"
  exit 0
fi

# Rollback on failure
echo "[self-deploy] Health check failed after $MAX_RETRIES attempts. Rolling back..."

if [ -d "$BACKUP_DIR/backend-dist" ]; then
  rm -rf packages/backend/dist
  cp -r "$BACKUP_DIR/backend-dist" packages/backend/dist
fi
if [ -d "$BACKUP_DIR/frontend-dist" ]; then
  rm -rf packages/frontend/dist
  cp -r "$BACKUP_DIR/frontend-dist" packages/frontend/dist
fi

echo "[self-deploy] Restoring commit $CURRENT_COMMIT..."
git checkout "$CURRENT_COMMIT"

echo "[self-deploy] Restarting shipit with rolled-back build..."
sudo systemctl restart shipit

# Verify rollback health
sleep $RETRY_INTERVAL
if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
  echo "[self-deploy] Rollback successful, service is healthy"
else
  echo "[self-deploy] WARNING: Service unhealthy even after rollback!"
fi

echo "[self-deploy] Deploy FAILED, rolled back to $CURRENT_COMMIT"
exit 1
