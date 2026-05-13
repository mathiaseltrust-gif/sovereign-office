#!/usr/bin/env bash
# =============================================================================
# Sovereign Office — Azure Container Apps Deployment
#
# Run this entirely in Azure Cloud Shell (portal.azure.com → Cloud Shell icon).
# No Docker, no VM, no local tools needed.
#
# Usage:
#   1. Go to https://portal.azure.com
#   2. Click the Cloud Shell icon (>_) at the top
#   3. Upload this file (click the upload button in Cloud Shell toolbar)
#   4. Run:  bash deploy-container-apps.sh
# =============================================================================

set -euo pipefail

# ── Configuration — all pre-filled ───────────────────────────────────────────
RESOURCE_GROUP="sovereign-office-rg"
LOCATION="eastus"
ENVIRONMENT_NAME="sovereign-office-env"

ACR_SERVER="sovereignoffice.azurecr.io"
ACR_USERNAME="sovereignoffice"
ACR_PASSWORD="16Ef4DDsKUCPWasmGFNNoEUjDnTYWcfrJnVdEfiRNxyNtwZphI6jJQQJ99CEACYeBjFEqg7NAAACAZCROBYv"

DATABASE_URL="postgresql://tribaladmin:ElevatedTrust2026@tribalpostgres-db.postgres.database.azure.com:5432/sovereign_office?sslmode=require"
SESSION_SECRET="f4c0e3b9c2d7a1f8e6b4c9d2a7f1e3b8c4d2a9f7b1e6c3d8f2a7b9c4e1d6f8a3c7b2d9e4f1a6c8b3d7e2f9a4c1b6d8e3f7a2c9"
SERVICE_KEY="241f3ea0fb713150b614e4b9f004521795f10cb30661b1aabecc4924046cb4fb"

ENTRA_TENANT_ID="3b71074d-80fb-46a1-a481-3aed69152480"
ENTRA_CLIENT_ID="9d408980-8fbf-4384-a712-436e70480eb9"
ENTRA_CLIENT_SECRET="zTJ8Q~y7HAdqW6oo-TXufAuf-qkwURI~151hDdqn"

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     Sovereign Office — Azure Container Apps Deployment       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── 1. Confirm subscription ───────────────────────────────────────────────────
echo "▶ Step 1/7 — Confirming Azure subscription..."
az account show --query "{subscription:name, id:id}" -o table
echo ""

# ── 2. Create resource group (skip if exists) ─────────────────────────────────
echo "▶ Step 2/7 — Resource group: $RESOURCE_GROUP"
if az group show --name "$RESOURCE_GROUP" &>/dev/null 2>&1; then
  echo "  ✓ Already exists — skipping"
else
  az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none
  echo "  ✓ Created"
fi

# ── 3. Create Container Apps environment ─────────────────────────────────────
echo ""
echo "▶ Step 3/7 — Container Apps environment: $ENVIRONMENT_NAME"
if az containerapp env show --name "$ENVIRONMENT_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null 2>&1; then
  echo "  ✓ Already exists — skipping"
else
  az containerapp env create \
    --name "$ENVIRONMENT_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --output none
  echo "  ✓ Created"
fi

# ── 4. Deploy API ─────────────────────────────────────────────────────────────
echo ""
echo "▶ Step 4/7 — Deploying API server..."
az containerapp create \
  --name "sovereign-api" \
  --resource-group "$RESOURCE_GROUP" \
  --environment "$ENVIRONMENT_NAME" \
  --image "$ACR_SERVER/sovereign-api:latest" \
  --registry-server "$ACR_SERVER" \
  --registry-username "$ACR_USERNAME" \
  --registry-password "$ACR_PASSWORD" \
  --target-port 8080 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 1.0 \
  --memory 2.0Gi \
  --env-vars \
    "PORT=8080" \
    "NODE_ENV=production" \
    "DATABASE_URL=$DATABASE_URL" \
    "SESSION_SECRET=$SESSION_SECRET" \
    "SERVICE_KEY=$SERVICE_KEY" \
    "AZURE_ENTRA_TENANT_ID=$ENTRA_TENANT_ID" \
    "AZURE_ENTRA_CLIENT_ID=$ENTRA_CLIENT_ID" \
    "AZURE_ENTRA_CLIENT_SECRET=$ENTRA_CLIENT_SECRET" \
    "LOG_LEVEL=info" \
  --output none 2>/dev/null || \
az containerapp update \
  --name "sovereign-api" \
  --resource-group "$RESOURCE_GROUP" \
  --image "$ACR_SERVER/sovereign-api:latest" \
  --output none

# Get the API URL
API_URL="https://$(az containerapp show \
  --name "sovereign-api" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" -o tsv)"

echo "  ✓ API deployed → $API_URL"

# Update API with its own URL now that we know it
az containerapp update \
  --name "sovereign-api" \
  --resource-group "$RESOURCE_GROUP" \
  --set-env-vars "APP_URL=$API_URL" \
  --output none

# ── 5. Deploy Sovereign Dashboard ─────────────────────────────────────────────
echo ""
echo "▶ Step 5/7 — Deploying Sovereign Office Dashboard..."
az containerapp create \
  --name "sovereign-dashboard" \
  --resource-group "$RESOURCE_GROUP" \
  --environment "$ENVIRONMENT_NAME" \
  --image "$ACR_SERVER/sovereign-dashboard:latest" \
  --registry-server "$ACR_SERVER" \
  --registry-username "$ACR_USERNAME" \
  --registry-password "$ACR_PASSWORD" \
  --target-port 80 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 2 \
  --cpu 0.5 \
  --memory 1.0Gi \
  --output none 2>/dev/null || \
az containerapp update \
  --name "sovereign-dashboard" \
  --resource-group "$RESOURCE_GROUP" \
  --image "$ACR_SERVER/sovereign-dashboard:latest" \
  --output none

SOVEREIGN_URL="https://$(az containerapp show \
  --name "sovereign-dashboard" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" -o tsv)"
echo "  ✓ Sovereign Dashboard → $SOVEREIGN_URL"

# ── 6. Deploy Trust Dashboard ─────────────────────────────────────────────────
echo ""
echo "▶ Step 6/7 — Deploying Trust Instruments Dashboard..."
az containerapp create \
  --name "trust-dashboard" \
  --resource-group "$RESOURCE_GROUP" \
  --environment "$ENVIRONMENT_NAME" \
  --image "$ACR_SERVER/trust-dashboard:latest" \
  --registry-server "$ACR_SERVER" \
  --registry-username "$ACR_USERNAME" \
  --registry-password "$ACR_PASSWORD" \
  --target-port 80 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 2 \
  --cpu 0.5 \
  --memory 1.0Gi \
  --output none 2>/dev/null || \
az containerapp update \
  --name "trust-dashboard" \
  --resource-group "$RESOURCE_GROUP" \
  --image "$ACR_SERVER/trust-dashboard:latest" \
  --output none

TRUST_URL="https://$(az containerapp show \
  --name "trust-dashboard" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" -o tsv)"
echo "  ✓ Trust Dashboard → $TRUST_URL"

# ── 7. Deploy Community Dashboard ─────────────────────────────────────────────
echo ""
echo "▶ Step 7/7 — Deploying Family & Community Dashboard..."
az containerapp create \
  --name "community-dashboard" \
  --resource-group "$RESOURCE_GROUP" \
  --environment "$ENVIRONMENT_NAME" \
  --image "$ACR_SERVER/community-dashboard:latest" \
  --registry-server "$ACR_SERVER" \
  --registry-username "$ACR_USERNAME" \
  --registry-password "$ACR_PASSWORD" \
  --target-port 80 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 2 \
  --cpu 0.5 \
  --memory 1.0Gi \
  --output none 2>/dev/null || \
az containerapp update \
  --name "community-dashboard" \
  --resource-group "$RESOURCE_GROUP" \
  --image "$ACR_SERVER/community-dashboard:latest" \
  --output none

COMMUNITY_URL="https://$(az containerapp show \
  --name "community-dashboard" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" -o tsv)"
echo "  ✓ Community Dashboard → $COMMUNITY_URL"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Deployment complete!                                        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  Your live URLs (all HTTPS, managed by Azure):"
echo ""
echo "  API Server:          $API_URL"
echo "  Sovereign Dashboard: $SOVEREIGN_URL"
echo "  Trust Dashboard:     $TRUST_URL"
echo "  Community Dashboard: $COMMUNITY_URL"
echo ""
echo "  ⚠  REQUIRED: Add this Redirect URI in Azure Portal:"
echo "  App Registrations → your app → Authentication → Redirect URIs"
echo ""
echo "  Add:  $API_URL/api/auth/callback"
echo ""
echo "  To update after a code change:"
echo "  bash deploy-container-apps.sh"
echo ""
echo "  To check status:"
echo "  az containerapp list --resource-group $RESOURCE_GROUP -o table"
echo ""
