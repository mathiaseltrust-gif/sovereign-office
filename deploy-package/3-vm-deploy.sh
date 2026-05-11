#!/usr/bin/env bash
# =============================================================================
# Sovereign Office — Step 3: Deploy on the Azure VM
#
# Run this ON YOUR AZURE VM (after SSH-ing in).
# Place this script, .env, and docker-compose.prod.yml in the same folder.
#
# Usage:
#   bash 3-vm-deploy.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "============================================================"
echo "  Sovereign Office — VM Deployment"
echo "============================================================"
echo ""

# 1. Install Docker if not present
if ! command -v docker &>/dev/null; then
  echo "Step 1 — Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  echo "Docker installed. You may need to log out and back in."
  echo "Then re-run this script."
  exit 0
else
  echo "Step 1 — Docker already installed. ✓"
fi

# 2. Check .env exists
if [ ! -f ".env" ]; then
  echo "ERROR: .env file not found in $SCRIPT_DIR"
  echo "Copy your filled-in .env file here first."
  exit 1
fi
echo "Step 2 — .env file found. ✓"

# Load env
set -a; source .env; set +a

# 3. Log into ACR
echo ""
echo "Step 3 — Logging into Azure Container Registry ($ACR_REGISTRY)..."
if [ -n "${ACR_USERNAME:-}" ] && [ -n "${ACR_PASSWORD:-}" ]; then
  echo "$ACR_PASSWORD" | docker login "$ACR_REGISTRY" -u "$ACR_USERNAME" --password-stdin
else
  echo "ACR_USERNAME/ACR_PASSWORD not set — trying az acr login..."
  az acr login --name "${ACR_REGISTRY%%.*}"
fi
echo "  ✓ Logged into ACR"

# 4. Pull latest images
echo ""
echo "Step 4 — Pulling latest images from $ACR_REGISTRY..."
docker compose -f docker-compose.prod.yml pull
echo "  ✓ Images pulled"

# 5. Start services
echo ""
echo "Step 5 — Starting all services..."

# Start with local postgres if USE_AZURE_DB is not true
if [ "${USE_AZURE_DB:-false}" = "true" ]; then
  echo "  Using Azure Database for PostgreSQL (skipping local postgres container)"
  docker compose -f docker-compose.prod.yml up -d api sovereign trust community
else
  docker compose -f docker-compose.prod.yml --profile local-db up -d
fi

echo ""
echo "Step 6 — Waiting for API health check..."
for i in $(seq 1 12); do
  if curl -sf http://localhost:8080/api/healthz > /dev/null 2>&1; then
    echo "  ✓ API is healthy"
    break
  fi
  echo "  Waiting... ($i/12)"
  sleep 5
done

# 7. Show status
echo ""
echo "============================================================"
echo "  Deployment complete!"
echo "============================================================"
echo ""
docker compose -f docker-compose.prod.yml ps
echo ""
echo "Your services are running at:"
echo "  API Server:            http://$(curl -sf ifconfig.me 2>/dev/null || echo 'YOUR-IP'):8080"
echo "  Sovereign Dashboard:   http://$(curl -sf ifconfig.me 2>/dev/null || echo 'YOUR-IP'):3001"
echo "  Trust Dashboard:       http://$(curl -sf ifconfig.me 2>/dev/null || echo 'YOUR-IP'):3002"
echo "  Community Dashboard:   http://$(curl -sf ifconfig.me 2>/dev/null || echo 'YOUR-IP'):3003"
echo ""
echo "Run logs:  docker compose -f docker-compose.prod.yml logs -f"
echo "Stop all:  docker compose -f docker-compose.prod.yml down"
echo ""
