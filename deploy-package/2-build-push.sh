#!/usr/bin/env bash
# =============================================================================
# Sovereign Office — Step 2: Build and Push Docker Images
#
# Run this from the ROOT of the cloned source repository, e.g.:
#   bash /path/to/deploy-folder/2-build-push.sh
#
# Requires:
#   - Docker running on your local machine
#   - .env file in this deploy folder (or set ACR_REGISTRY manually below)
#   - Logged into ACR (script handles this)
# =============================================================================

set -euo pipefail

# ── Load .env from the same folder as this script ───────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: .env not found at $ENV_FILE"
  echo "Copy .env.template to .env and fill in values first."
  exit 1
fi

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

if [ -z "${ACR_REGISTRY:-}" ]; then
  echo "ERROR: ACR_REGISTRY is not set in .env"
  exit 1
fi

TAG="${IMAGE_TAG:-latest}"

echo ""
echo "============================================================"
echo "  Sovereign Office — Build & Push to $ACR_REGISTRY"
echo "============================================================"
echo ""

# 1. Log into ACR
echo "Step 1/6 — Logging into Azure Container Registry..."
if [ -n "${ACR_USERNAME:-}" ] && [ -n "${ACR_PASSWORD:-}" ]; then
  echo "$ACR_PASSWORD" | docker login "$ACR_REGISTRY" -u "$ACR_USERNAME" --password-stdin
else
  az acr login --name "${ACR_REGISTRY%%.*}"
fi
echo ""

# 2–5: Build and push each image
build_and_push() {
  local NAME="$1"
  local DOCKERFILE="$2"
  local EXTRA_ARGS="${3:-}"
  local FULL_TAG="$ACR_REGISTRY/$NAME:$TAG"

  echo "Building $NAME..."
  # shellcheck disable=SC2086
  docker build \
    --file "$DOCKERFILE" \
    --tag "$FULL_TAG" \
    $EXTRA_ARGS \
    .
  echo "Pushing $NAME..."
  docker push "$FULL_TAG"
  echo "  ✓ $FULL_TAG"
  echo ""
}

echo "Step 2/6 — API Server..."
build_and_push "sovereign-api" \
  "artifacts/api-server/Dockerfile"

echo "Step 3/6 — Sovereign Dashboard..."
build_and_push "sovereign-dashboard" \
  "artifacts/sovereign-dashboard/Dockerfile" \
  "--build-arg BASE_PATH=/ --build-arg VITE_API_URL=${APP_URL:-http://localhost:8080}"

echo "Step 4/6 — Trust Dashboard..."
build_and_push "trust-dashboard" \
  "artifacts/trust-dashboard/Dockerfile" \
  "--build-arg BASE_PATH=/ --build-arg VITE_API_URL=${APP_URL:-http://localhost:8080}"

echo "Step 5/6 — Community Dashboard..."
build_and_push "community-dashboard" \
  "artifacts/community-dashboard/Dockerfile" \
  "--build-arg VITE_API_URL=${APP_URL:-http://localhost:8080}"

echo "Step 6/6 — Done!"
echo ""
echo "============================================================"
echo "  All images pushed to $ACR_REGISTRY"
echo "============================================================"
echo ""
echo "Next step: copy .env and docker-compose.prod.yml to your VM,"
echo "then run:  bash 3-vm-deploy.sh"
echo ""
