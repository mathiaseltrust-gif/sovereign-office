#!/usr/bin/env bash
# =============================================================================
# Sovereign Office — Azure VM Bootstrap Script
#
# Run this ONCE on a fresh Azure VM to install Docker, pull images from ACR,
# and start all four dashboards.
#
# Prerequisites:
#   - Ubuntu 22.04 LTS VM at 20.83.210.26
#   - This script and your .env file in the same directory
#   - Inbound ports open: 8080, 3001, 3002, 3003
#
# Usage:
#   chmod +x vm-bootstrap.sh
#   ./vm-bootstrap.sh
# =============================================================================

set -euo pipefail

ACR_REGISTRY="sovereignoffice.azurecr.io"
ACR_USERNAME="sovereignoffice"
DEPLOY_DIR="/opt/sovereign-office"

echo "============================================================"
echo "  Sovereign Office — VM Bootstrap"
echo "============================================================"

# ── 1. Install Docker ─────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo ""
  echo "==> Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  sudo systemctl enable --now docker
  echo "    Docker installed."
else
  echo "==> Docker already installed — skipping."
fi

# ── 2. Install Docker Compose plugin ─────────────────────────────────────────
if ! docker compose version &>/dev/null; then
  echo ""
  echo "==> Installing Docker Compose plugin..."
  sudo apt-get install -y docker-compose-plugin
else
  echo "==> Docker Compose already installed — skipping."
fi

# ── 3. Create deploy directory ────────────────────────────────────────────────
echo ""
echo "==> Setting up deploy directory at $DEPLOY_DIR"
sudo mkdir -p "$DEPLOY_DIR"
sudo chown "$USER:$USER" "$DEPLOY_DIR"

# Copy files to deploy dir
cp docker-compose.prod.yml "$DEPLOY_DIR/docker-compose.prod.yml"

if [[ -f .env ]]; then
  cp .env "$DEPLOY_DIR/.env"
  echo "    .env copied."
else
  echo ""
  echo "  ERROR: .env file not found in current directory."
  echo "  Copy deploy-package/.env.template to .env, fill in all values, then re-run."
  exit 1
fi

# ── 4. Open firewall ports ────────────────────────────────────────────────────
echo ""
echo "==> Opening ports 8080, 3001, 3002, 3003 in UFW..."
sudo ufw allow 8080/tcp 2>/dev/null || true
sudo ufw allow 3001/tcp 2>/dev/null || true
sudo ufw allow 3002/tcp 2>/dev/null || true
sudo ufw allow 3003/tcp 2>/dev/null || true
sudo ufw reload 2>/dev/null || true

# ── 5. Load .env and login to ACR ────────────────────────────────────────────
echo ""
echo "==> Logging in to Azure Container Registry..."
cd "$DEPLOY_DIR"
source .env

echo "$ACR_PASSWORD" | \
  docker login "$ACR_REGISTRY" \
    --username "$ACR_USERNAME" \
    --password-stdin

echo "    Login successful."

# ── 6. Pull all images ────────────────────────────────────────────────────────
echo ""
echo "==> Pulling images from ACR (this may take a few minutes)..."
docker compose -f docker-compose.prod.yml pull api sovereign trust community

# ── 7. Start all services ─────────────────────────────────────────────────────
echo ""
echo "==> Starting all services..."
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "==> Waiting for API health check..."
timeout 120 bash -c \
  'until docker compose -f docker-compose.prod.yml ps api | grep -q "healthy"; do
    echo "    ... waiting"; sleep 5
  done' || {
  echo ""
  echo "  WARNING: API did not become healthy within 2 minutes."
  echo "  Check logs with: docker compose -f docker-compose.prod.yml logs api"
}

# ── 8. Status ─────────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo "  Running services:"
docker compose -f docker-compose.prod.yml ps
echo ""
echo "  Your dashboards are live at:"
echo "    API Server:          http://20.83.210.26:8080"
echo "    Sovereign Dashboard: http://20.83.210.26:3001"
echo "    Trust Dashboard:     http://20.83.210.26:3002"
echo "    Community Dashboard: http://20.83.210.26:3003"
echo ""
echo "  To view logs:    docker compose -f docker-compose.prod.yml logs -f"
echo "  To stop:         docker compose -f docker-compose.prod.yml down"
echo "  To update:       docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d"
echo "============================================================"
