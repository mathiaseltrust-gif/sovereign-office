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

# ── Image tag — versioned to force ACR pull (never use :latest — Azure caches it) ──
IMAGE_TAG="v$(date +%Y%m%d-%H%M)"

# ── Configuration — all pre-filled ───────────────────────────────────────────
RESOURCE_GROUP="sovereign-office-rg"
LOCATION="eastus"
ENVIRONMENT_NAME="sovereign-office-env"

ACR_SERVER="${ACR_SERVER:-sovereignoffice.azurecr.io}"
ACR_USERNAME="${ACR_USERNAME:-sovereignoffice}"
: "${ACR_PASSWORD:?Set ACR_PASSWORD in the shell or secret store before running this script}"

: "${DATABASE_URL:?Set DATABASE_URL in the shell or secret store before running this script}"
: "${SESSION_SECRET:?Set SESSION_SECRET in the shell or secret store before running this script}"
: "${SERVICE_KEY:?Set SERVICE_KEY in the shell or secret store before running this script}"

ENTRA_TENANT_ID="${AZURE_ENTRA_TENANT_ID:-${ENTRA_TENANT_ID:-}}"
ENTRA_CLIENT_ID="${AZURE_ENTRA_CLIENT_ID:-${ENTRA_CLIENT_ID:-}}"
ENTRA_CLIENT_SECRET="${AZURE_ENTRA_CLIENT_SECRET:-${ENTRA_CLIENT_SECRET:-}}"
: "${ENTRA_TENANT_ID:?Set AZURE_ENTRA_TENANT_ID before running this script}"
: "${ENTRA_CLIENT_ID:?Set AZURE_ENTRA_CLIENT_ID before running this script}"
: "${ENTRA_CLIENT_SECRET:?Set AZURE_ENTRA_CLIENT_SECRET before running this script}"

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
  --image "$ACR_SERVER/sovereign-api:$IMAGE_TAG" \
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
  --image "$ACR_SERVER/sovereign-api:$IMAGE_TAG" \
  --set-env-vars \
    "PORT=8080" \
    "NODE_ENV=production" \
    "DATABASE_URL=$DATABASE_URL" \
    "SESSION_SECRET=$SESSION_SECRET" \
    "SERVICE_KEY=$SERVICE_KEY" \
    "AZURE_ENTRA_TENANT_ID=$ENTRA_TENANT_ID" \
    "AZURE_ENTRA_CLIENT_ID=$ENTRA_CLIENT_ID" \
    "AZURE_ENTRA_CLIENT_SECRET=$ENTRA_CLIENT_SECRET" \
    "LOG_LEVEL=info" \
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
  --image "$ACR_SERVER/sovereign-dashboard:$IMAGE_TAG" \
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
  --image "$ACR_SERVER/sovereign-dashboard:$IMAGE_TAG" \
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
  --image "$ACR_SERVER/trust-dashboard:$IMAGE_TAG" \
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
  --image "$ACR_SERVER/trust-dashboard:$IMAGE_TAG" \
  --output none

TRUST_URL="https://$(az containerapp show \
  --name "trust-dashboard" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" -o tsv)"
echo "  ✓ Trust Dashboard → $TRUST_URL"

# ── 7. Deploy Community Dashboard ─────────────────────────────────────────────
echo ""
echo "▶ Step 7/8 — Deploying Family & Community Dashboard..."
az containerapp create \
  --name "community-dashboard" \
  --resource-group "$RESOURCE_GROUP" \
  --environment "$ENVIRONMENT_NAME" \
  --image "$ACR_SERVER/community-dashboard:$IMAGE_TAG" \
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
  --image "$ACR_SERVER/community-dashboard:$IMAGE_TAG" \
  --output none

COMMUNITY_URL="https://$(az containerapp show \
  --name "community-dashboard" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" -o tsv)"
echo "  ✓ Community Dashboard → $COMMUNITY_URL"

# ── 8. Deploy Urban Indian Continuity Atlas ────────────────────────────────────
echo ""
echo "▶ Step 8/8 — Deploying Urban Indian Continuity Atlas..."
az containerapp create \
  --name "urban-indian-atlas" \
  --resource-group "$RESOURCE_GROUP" \
  --environment "$ENVIRONMENT_NAME" \
  --image "$ACR_SERVER/urban-indian-atlas:$IMAGE_TAG" \
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
  --name "urban-indian-atlas" \
  --resource-group "$RESOURCE_GROUP" \
  --image "$ACR_SERVER/urban-indian-atlas:$IMAGE_TAG" \
  --output none

ATLAS_URL="https://$(az containerapp show \
  --name "urban-indian-atlas" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" -o tsv)"
echo "  ✓ Urban Indian Atlas → $ATLAS_URL"

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
echo "  Urban Indian Atlas:  $ATLAS_URL"
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
