#!/usr/bin/env bash
# =============================================================================
# Sovereign Office — One-Command Azure Deploy
#
# Run this script on your Azure VM. It installs Docker, writes all config,
# pulls all 4 images from ACR, runs database migrations, and starts everything.
#
# Usage (paste this entire script into your SSH session, or run the file):
#   bash sovereign-install.sh
# =============================================================================

set -euo pipefail

DEPLOY_DIR="/opt/sovereign-office"
ACR_REGISTRY="sovereignoffice.azurecr.io"
ACR_USERNAME="sovereignoffice"
ACR_PASSWORD="16Ef4DDsKUCPWasmGFNNoEUjDnTYWcfrJnVdEfiRNxyNtwZphI6jJQQJ99CEACYeBjFEqg7NAAACAZCROBYv"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║        Sovereign Office — Azure Deployment                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Install Docker ────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "▶ Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  sudo systemctl enable --now docker
  # Activate group without logout
  exec sg docker "$0"
else
  echo "✓ Docker already installed"
fi

# ── Step 2: Install Docker Compose plugin ─────────────────────────────────────
if ! docker compose version &>/dev/null 2>&1; then
  echo "▶ Installing Docker Compose plugin..."
  sudo apt-get install -y docker-compose-plugin 2>/dev/null || \
  sudo yum install -y docker-compose-plugin 2>/dev/null || true
fi
echo "✓ Docker Compose ready"

# ── Step 3: Create deploy directory ───────────────────────────────────────────
echo ""
echo "▶ Setting up $DEPLOY_DIR ..."
sudo mkdir -p "$DEPLOY_DIR"
sudo chown "$USER:$USER" "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

# ── Step 4: Write .env ────────────────────────────────────────────────────────
echo "▶ Writing .env ..."
cat > .env << 'ENVEOF'
DATABASE_URL=postgresql://tribaladmin:TribalSecurePass2026@tribalpostgres-db.postgres.database.azure.com:5432/sovereign_office?sslmode=require
POSTGRES_PASSWORD=TribalSecurePass2026

SESSION_SECRET=f4c0e3b9c2d7a1f8e6b4c9d2a7f1e3b8c4d2a9f7b1e6c3d8f2a7b9c4e1d6f8a3c7b2d9e4f1a6c8b3d7e2f9a4c1b6d8e3f7a2c9
SERVICE_KEY=241f3ea0fb713150b614e4b9f004521795f10cb30661b1aabecc4924046cb4fb

APP_URL=http://20.83.210.26:8080
SOVEREIGN_DASHBOARD_URL=http://20.83.210.26:3001
TRUST_DASHBOARD_URL=http://20.83.210.26:3002
COMMUNITY_DASHBOARD_URL=http://20.83.210.26:3003

AZURE_ENTRA_TENANT_ID=3b71074d-80fb-46a1-a481-3aed69152480
AZURE_ENTRA_CLIENT_ID=9d408980-8fbf-4384-a712-436e70480eb9
AZURE_ENTRA_CLIENT_SECRET=zTJ8Q~y7HAdqW6oo-TXufAuf-qkwURI~151hDdqn

AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT=

ACR_REGISTRY=sovereignoffice.azurecr.io
ACR_LOGIN_SERVER=sovereignoffice.azurecr.io
ACR_USERNAME=sovereignoffice
ACR_PASSWORD=16Ef4DDsKUCPWasmGFNNoEUjDnTYWcfrJnVdEfiRNxyNtwZphI6jJQQJ99CEACYeBjFEqg7NAAACAZCROBYv
IMAGE_TAG=latest

LOG_LEVEL=info
NODE_ENV=production
ENVEOF
echo "✓ .env written"

# ── Step 5: Write docker-compose.prod.yml ─────────────────────────────────────
echo "▶ Writing docker-compose.prod.yml ..."
cat > docker-compose.prod.yml << 'COMPOSEEOF'
services:

  api:
    image: sovereignoffice.azurecr.io/sovereign-api:latest
    restart: unless-stopped
    ports:
      - "8080:8080"
    env_file: .env
    environment:
      PORT: "8080"
      NODE_ENV: production
    healthcheck:
      test: ["CMD-SHELL", "node -e \"require('http').get('http://localhost:8080/api/healthz', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))\""]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 60s

  sovereign:
    image: sovereignoffice.azurecr.io/sovereign-dashboard:latest
    restart: unless-stopped
    ports:
      - "3001:80"
    depends_on:
      api:
        condition: service_healthy

  trust:
    image: sovereignoffice.azurecr.io/trust-dashboard:latest
    restart: unless-stopped
    ports:
      - "3002:80"
    depends_on:
      api:
        condition: service_healthy

  community:
    image: sovereignoffice.azurecr.io/community-dashboard:latest
    restart: unless-stopped
    ports:
      - "3003:80"
    depends_on:
      api:
        condition: service_healthy
COMPOSEEOF
echo "✓ docker-compose.prod.yml written"

# ── Step 6: Open firewall ports ───────────────────────────────────────────────
echo ""
echo "▶ Opening firewall ports..."
for port in 8080 3001 3002 3003; do
  sudo ufw allow "$port/tcp" 2>/dev/null || true
done
sudo ufw reload 2>/dev/null || true
echo "✓ Ports 8080, 3001, 3002, 3003 open"

# ── Step 7: Log in to ACR ─────────────────────────────────────────────────────
echo ""
echo "▶ Logging in to Azure Container Registry..."
echo "$ACR_PASSWORD" | docker login "$ACR_REGISTRY" -u "$ACR_USERNAME" --password-stdin
echo "✓ ACR login successful"

# ── Step 8: Pull all images ───────────────────────────────────────────────────
echo ""
echo "▶ Pulling images from ACR (may take a few minutes)..."
docker compose -f docker-compose.prod.yml pull
echo "✓ All images pulled"

# ── Step 9: Start services ────────────────────────────────────────────────────
echo ""
echo "▶ Starting all services..."
docker compose -f docker-compose.prod.yml up -d
echo "✓ Services started"

# ── Step 10: Wait for API (runs DB migrations on first boot) ──────────────────
echo ""
echo "▶ Waiting for API to come online (DB migrations run on first boot)..."
WAIT=0
until curl -sf http://localhost:8080/api/healthz > /dev/null 2>&1; do
  WAIT=$((WAIT+5))
  if [ $WAIT -ge 120 ]; then
    echo ""
    echo "  ⚠  API took longer than 2 min — showing last 30 log lines:"
    docker compose -f docker-compose.prod.yml logs --tail=30 api
    echo ""
    echo "  Check full logs with:  docker compose -f docker-compose.prod.yml logs -f api"
    break
  fi
  echo "  ... $WAIT s"
  sleep 5
done

if curl -sf http://localhost:8080/api/healthz > /dev/null 2>&1; then
  echo "✓ API is healthy"
fi

# ── Step 11: Status ───────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Deployment complete!                                        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
docker compose -f docker-compose.prod.yml ps
echo ""
PUBLIC_IP=$(curl -sf --max-time 5 ifconfig.me 2>/dev/null || echo "20.83.210.26")
echo "  API Server:          http://$PUBLIC_IP:8080"
echo "  Sovereign Dashboard: http://$PUBLIC_IP:3001"
echo "  Trust Dashboard:     http://$PUBLIC_IP:3002"
echo "  Community Dashboard: http://$PUBLIC_IP:3003"
echo ""
echo "  Useful commands:"
echo "    Logs:    docker compose -f $DEPLOY_DIR/docker-compose.prod.yml logs -f"
echo "    Status:  docker compose -f $DEPLOY_DIR/docker-compose.prod.yml ps"
echo "    Update:  docker compose -f $DEPLOY_DIR/docker-compose.prod.yml pull && \\"
echo "             docker compose -f $DEPLOY_DIR/docker-compose.prod.yml up -d"
echo "    Stop:    docker compose -f $DEPLOY_DIR/docker-compose.prod.yml down"
echo ""
