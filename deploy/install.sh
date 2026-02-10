#!/bin/bash
set -euo pipefail

SHIPIT_DIR="/opt/shipit"
SHIPIT_USER="shipit"
REPO_URL="${1:-}"

echo "=== ShipIt Installer ==="

# Check root
if [ "$(id -u)" -ne 0 ]; then
    echo "Error: run as root (sudo)"
    exit 1
fi

# Create shipit user if not exists
if ! id "$SHIPIT_USER" &>/dev/null; then
    echo "Creating user $SHIPIT_USER..."
    useradd -r -m -s /bin/bash "$SHIPIT_USER"
fi

# Create data directory
mkdir -p /var/lib/shipit
chown "$SHIPIT_USER:$SHIPIT_USER" /var/lib/shipit

# Install or update code
if [ -d "$SHIPIT_DIR/.git" ]; then
    echo "Updating existing installation..."
    cd "$SHIPIT_DIR"
    sudo -u "$SHIPIT_USER" git pull origin main
else
    if [ -z "$REPO_URL" ]; then
        echo "Error: first install requires repo URL as argument"
        echo "Usage: $0 <git-repo-url>"
        exit 1
    fi
    echo "Cloning repository..."
    git clone "$REPO_URL" "$SHIPIT_DIR"
    chown -R "$SHIPIT_USER:$SHIPIT_USER" "$SHIPIT_DIR"
fi

cd "$SHIPIT_DIR"

# Install dependencies
echo "Installing dependencies..."
sudo -u "$SHIPIT_USER" npm ci --workspaces

# Build
echo "Building backend..."
sudo -u "$SHIPIT_USER" npm run build -w packages/backend

echo "Building frontend..."
sudo -u "$SHIPIT_USER" npm run build -w packages/frontend

# Setup .env if not exists
if [ ! -f "$SHIPIT_DIR/.env" ]; then
    echo "Creating .env from template..."
    cp "$SHIPIT_DIR/deploy/.env.example" "$SHIPIT_DIR/.env"
    chown "$SHIPIT_USER:$SHIPIT_USER" "$SHIPIT_DIR/.env"
    chmod 600 "$SHIPIT_DIR/.env"
    echo "IMPORTANT: edit /opt/shipit/.env with your settings"
fi

# Install systemd service
echo "Installing systemd service..."
cp "$SHIPIT_DIR/deploy/shipit.service" /etc/systemd/system/shipit.service
systemctl daemon-reload
systemctl enable shipit

# Install nginx config
echo "Installing Nginx config..."
cp "$SHIPIT_DIR/deploy/nginx-shipit.conf" /etc/nginx/sites-available/shipit
ln -sf /etc/nginx/sites-available/shipit /etc/nginx/sites-enabled/shipit

# Test nginx config
nginx -t

# Start/restart services
echo "Starting services..."
systemctl restart shipit
systemctl reload nginx

# Health check
echo "Running health check..."
sleep 2
for i in {1..5}; do
    if curl -sf http://127.0.0.1:3001/api/health > /dev/null 2>&1; then
        echo "Health check passed!"
        echo ""
        echo "=== ShipIt installed successfully ==="
        echo "API:       http://127.0.0.1:3001"
        echo "Dashboard: http://$(hostname -I | awk '{print $1}')"
        echo "Config:    /opt/shipit/.env"
        echo "Logs:      journalctl -u shipit -f"
        exit 0
    fi
    echo "Waiting for ShipIt to start (attempt $i/5)..."
    sleep 2
done

echo "WARNING: Health check failed. Check logs: journalctl -u shipit -e"
exit 1
