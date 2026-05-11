#!/usr/bin/env bash
# =============================================================================
# Sovereign Office — Step 1: Provision Azure Resources
#
# Run this ONCE on your local machine to create:
#   - Azure Resource Group
#   - Azure Container Registry (ACR)
#
# After this script, copy the printed values into your .env file.
# =============================================================================

set -euo pipefail

# ── Configuration — edit these ───────────────────────────────────────────────
RESOURCE_GROUP="sovereign-office-rg"
LOCATION="eastus"                       # Azure region (eastus, westus2, centralus, etc.)
ACR_NAME="sovereignoffice"              # Must be globally unique, letters/numbers only
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "============================================================"
echo "  Sovereign Office — Azure Resource Provisioning"
echo "============================================================"
echo ""

# 1. Login
echo "Step 1/4 — Logging into Azure..."
az login
echo ""

# 2. Resource Group
echo "Step 2/4 — Creating resource group: $RESOURCE_GROUP in $LOCATION..."
az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --output table
echo ""

# 3. Container Registry
echo "Step 3/4 — Creating Azure Container Registry: $ACR_NAME..."
az acr create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --sku Basic \
  --admin-enabled true \
  --output table
echo ""

# 4. Get credentials
echo "Step 4/4 — Fetching ACR credentials..."
ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)
ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" -o tsv)

echo ""
echo "============================================================"
echo "  SUCCESS — Copy these values into your .env file:"
echo "============================================================"
echo ""
echo "  ACR_REGISTRY=$ACR_LOGIN_SERVER"
echo "  ACR_USERNAME=$ACR_USERNAME"
echo "  ACR_PASSWORD=$ACR_PASSWORD"
echo ""
echo "============================================================"
echo ""
echo "Next step: run  bash 2-build-push.sh  from the source repo root"
echo ""
