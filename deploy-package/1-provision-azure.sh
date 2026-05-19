#!/usr/bin/env bash
# =============================================================================
# Sovereign Office — Step 1: Provision Azure Infrastructure
#
# Run this ONCE from your local machine (requires az CLI, logged in to the
# nonprofit subscription) to create every Azure resource needed to run the
# five-app stack:
#
#   • Resource Group
#   • Azure Container Registry (ACR)
#   • Linux VM  (Standard B2ms — 2 vCPU, 8 GB RAM)
#   • Network Security Group rules (inbound 22, 8080, 3001–3004)
#   • Azure Database for PostgreSQL — Flexible Server (B2ms burstable)
#   • Azure Blob Storage account (nightly backup container)
#
# Cost estimate (Microsoft Nonprofit grant credits):
#   VM B2ms           ~$60/mo
#   PostgreSQL B2ms   ~$50/mo
#   ACR Basic         ~$5/mo
#   Blob LRS ~50 GB   ~$3/mo
#   Bandwidth         ~$5/mo
#   Total             ~$123/mo  (well within $291/mo grant)
#
# After this script completes, copy the printed values into .env and proceed
# with  bash 2-build-push.sh  (from the repo root).
# =============================================================================

set -euo pipefail

# ── Configuration — edit if needed ───────────────────────────────────────────
RESOURCE_GROUP="sovereign-office-rg"
LOCATION="eastus"

ACR_NAME="sovereignoffice"

VM_NAME="sovereign-office-vm"
VM_SIZE="Standard_B2ms"
VM_IMAGE="Ubuntu2204"
VM_ADMIN="azureuser"
# SSH public key — defaults to ~/.ssh/id_ed25519.pub; set VM_SSH_KEY_PATH to override
VM_SSH_KEY_PATH="${VM_SSH_KEY_PATH:-${HOME}/.ssh/id_ed25519.pub}"

PG_SERVER_NAME="tribalpostgres-db"
PG_ADMIN="tribaladmin"
PG_PASSWORD="${PG_PASSWORD:-$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 24)}"
PG_DB="sovereign_office"
PG_SKU="Standard_B2ms"

STORAGE_ACCOUNT="${STORAGE_ACCOUNT:-sovereignofficebackup}"  # must be globally unique
BACKUP_CONTAINER="db-backups"
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║     Sovereign Office — Azure Infrastructure Provisioning             ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "  Resource Group : $RESOURCE_GROUP"
echo "  Location       : $LOCATION"
echo "  VM             : $VM_NAME ($VM_SIZE)"
echo "  PostgreSQL     : $PG_SERVER_NAME"
echo "  Storage        : $STORAGE_ACCOUNT"
echo ""

# ── Step 1: Login ─────────────────────────────────────────────────────────────
echo "Step 1/9 — Logging in to Azure..."
az account show --query "{subscription:name, id:id}" -o table 2>/dev/null || az login
echo ""

# ── Step 2: Resource Group ───────────────────────────────────────────────────
echo "Step 2/9 — Resource group: $RESOURCE_GROUP"
if az group show --name "$RESOURCE_GROUP" &>/dev/null 2>&1; then
  echo "  ✓ Already exists — skipping"
else
  az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none
  echo "  ✓ Created"
fi
echo ""

# ── Step 3: Container Registry ───────────────────────────────────────────────
echo "Step 3/9 — Azure Container Registry: $ACR_NAME"
if az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null 2>&1; then
  echo "  ✓ Already exists — skipping"
else
  az acr create \
    --resource-group "$RESOURCE_GROUP" \
    --name "$ACR_NAME" \
    --sku Basic \
    --admin-enabled true \
    --output none
  echo "  ✓ Created"
fi
ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)
ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" -o tsv)
echo "  ACR_REGISTRY=$ACR_LOGIN_SERVER"
echo ""

# ── Step 4: Virtual Machine ───────────────────────────────────────────────────
echo "Step 4/9 — Linux VM: $VM_NAME ($VM_SIZE)"
if az vm show --name "$VM_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null 2>&1; then
  echo "  ✓ Already exists — skipping VM creation"
else
  if [[ ! -f "$VM_SSH_KEY_PATH" ]]; then
    echo "  SSH public key not found at $VM_SSH_KEY_PATH"
    echo "  Generating an ed25519 key pair..."
    ssh-keygen -t ed25519 -C "sovereign-office-deploy" -f "${HOME}/.ssh/id_ed25519" -N ""
  fi

  az vm create \
    --resource-group "$RESOURCE_GROUP" \
    --name "$VM_NAME" \
    --size "$VM_SIZE" \
    --image "$VM_IMAGE" \
    --admin-username "$VM_ADMIN" \
    --ssh-key-values "$VM_SSH_KEY_PATH" \
    --public-ip-sku Standard \
    --output none
  echo "  ✓ VM created"
fi
VM_IP=$(az vm show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$VM_NAME" \
  --show-details \
  --query publicIps -o tsv)
echo "  VM Public IP: $VM_IP"
echo ""

# ── Step 5: Network Security Group rules ─────────────────────────────────────
echo "Step 5/9 — Firewall / NSG rules (SSH + app ports)"
NSG_NAME="${VM_NAME}NSG"
# Priorities 1100–1104 — well within the valid Azure range of 100–4096
declare -A PORT_PRIORITY=( [8080]=1100 [3001]=1101 [3002]=1102 [3003]=1103 [3004]=1104 )
for PORT in 8080 3001 3002 3003 3004; do
  RULE_NAME="Allow-${PORT}"
  PRIORITY="${PORT_PRIORITY[$PORT]}"
  if az network nsg rule show \
       --resource-group "$RESOURCE_GROUP" \
       --nsg-name "$NSG_NAME" \
       --name "$RULE_NAME" &>/dev/null 2>&1; then
    echo "  ✓ Port $PORT rule already exists"
  else
    az network nsg rule create \
      --resource-group "$RESOURCE_GROUP" \
      --nsg-name "$NSG_NAME" \
      --name "$RULE_NAME" \
      --protocol Tcp \
      --direction Inbound \
      --priority "$PRIORITY" \
      --source-address-prefix '*' \
      --source-port-range '*' \
      --destination-address-prefix '*' \
      --destination-port-range "$PORT" \
      --access Allow \
      --output none
    echo "  ✓ Port $PORT opened (priority $PRIORITY)"
  fi
done
echo ""

# ── Step 6: Azure Database for PostgreSQL — Flexible Server ──────────────────
echo "Step 6/9 — PostgreSQL Flexible Server: $PG_SERVER_NAME"
if az postgres flexible-server show \
     --resource-group "$RESOURCE_GROUP" \
     --name "$PG_SERVER_NAME" &>/dev/null 2>&1; then
  echo "  ✓ Already exists — skipping"
else
  az postgres flexible-server create \
    --resource-group "$RESOURCE_GROUP" \
    --name "$PG_SERVER_NAME" \
    --location "$LOCATION" \
    --admin-user "$PG_ADMIN" \
    --admin-password "$PG_PASSWORD" \
    --sku-name "$PG_SKU" \
    --tier Burstable \
    --version 16 \
    --public-access 0.0.0.0 \
    --output none
  echo "  ✓ Created"
fi

# Create the database if missing
if ! az postgres flexible-server db show \
       --resource-group "$RESOURCE_GROUP" \
       --server-name "$PG_SERVER_NAME" \
       --database-name "$PG_DB" &>/dev/null 2>&1; then
  az postgres flexible-server db create \
    --resource-group "$RESOURCE_GROUP" \
    --server-name "$PG_SERVER_NAME" \
    --database-name "$PG_DB" \
    --output none
  echo "  ✓ Database $PG_DB created"
fi

PG_HOST="${PG_SERVER_NAME}.postgres.database.azure.com"
DATABASE_URL="postgresql://${PG_ADMIN}:${PG_PASSWORD}@${PG_HOST}:5432/${PG_DB}?sslmode=require"
echo "  Host: $PG_HOST"
echo ""

# ── Step 7: Firewall rule — allow VM to reach PostgreSQL ─────────────────────
echo "Step 7/9 — Allow VM IP to connect to PostgreSQL firewall"
az postgres flexible-server firewall-rule create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$PG_SERVER_NAME" \
  --rule-name "AllowVM" \
  --start-ip-address "$VM_IP" \
  --end-ip-address "$VM_IP" \
  --output none 2>/dev/null || \
az postgres flexible-server firewall-rule update \
  --resource-group "$RESOURCE_GROUP" \
  --name "$PG_SERVER_NAME" \
  --rule-name "AllowVM" \
  --start-ip-address "$VM_IP" \
  --end-ip-address "$VM_IP" \
  --output none
echo "  ✓ VM ($VM_IP) allowed through PostgreSQL firewall"
echo ""

# ── Step 8: Blob Storage account ─────────────────────────────────────────────
echo "Step 8/9 — Blob Storage account: $STORAGE_ACCOUNT"
if az storage account show --name "$STORAGE_ACCOUNT" \
     --resource-group "$RESOURCE_GROUP" &>/dev/null 2>&1; then
  echo "  ✓ Already exists — skipping"
else
  az storage account create \
    --name "$STORAGE_ACCOUNT" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --sku Standard_LRS \
    --kind StorageV2 \
    --output none
  echo "  ✓ Storage account created"
fi

STORAGE_KEY=$(az storage account keys list \
  --account-name "$STORAGE_ACCOUNT" \
  --resource-group "$RESOURCE_GROUP" \
  --query "[0].value" -o tsv)

# Create backup container if missing
az storage container create \
  --name "$BACKUP_CONTAINER" \
  --account-name "$STORAGE_ACCOUNT" \
  --account-key "$STORAGE_KEY" \
  --output none 2>/dev/null || true
echo "  ✓ Backup container: $BACKUP_CONTAINER"
echo ""

# ── Step 9: Summary ───────────────────────────────────────────────────────────
echo "Step 9/9 — Done!"
echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║  SUCCESS — Copy these values into deploy-package/.env               ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "  # Azure VM"
echo "  DEPLOY_HOST=$VM_IP"
echo "  DEPLOY_USER=$VM_ADMIN"
echo "  DEPLOY_PATH=/opt/sovereign-office"
echo ""
echo "  # Service URLs"
echo "  APP_URL=http://$VM_IP:8080"
echo "  SOVEREIGN_DASHBOARD_URL=http://$VM_IP:3001"
echo "  TRUST_DASHBOARD_URL=http://$VM_IP:3002"
echo "  COMMUNITY_DASHBOARD_URL=http://$VM_IP:3003"
echo "  ATLAS_DASHBOARD_URL=http://$VM_IP:3004"
echo ""
echo "  # Azure Container Registry"
echo "  ACR_REGISTRY=$ACR_LOGIN_SERVER"
echo "  ACR_USERNAME=$ACR_USERNAME"
echo "  ACR_PASSWORD=$ACR_PASSWORD"
echo ""
echo "  # PostgreSQL"
echo "  DATABASE_URL=$DATABASE_URL"
echo "  POSTGRES_PASSWORD=$PG_PASSWORD"
echo ""
echo "  # Blob Storage (backups)"
echo "  AZURE_STORAGE_ACCOUNT=$STORAGE_ACCOUNT"
echo "  AZURE_STORAGE_KEY=$STORAGE_KEY"
echo "  AZURE_BACKUP_CONTAINER=$BACKUP_CONTAINER"
echo ""
echo "GitHub Actions secrets to add (Settings → Secrets → Actions):"
echo "  ACR_REGISTRY, ACR_USERNAME, ACR_PASSWORD"
echo "  DEPLOY_HOST=$VM_IP  DEPLOY_USER=$VM_ADMIN  DEPLOY_PATH=/opt/sovereign-office"
echo "  DEPLOY_SSH_KEY — paste the private key matching $VM_SSH_KEY_PATH"
echo ""
echo "Next: bash 2-build-push.sh  (from the repo root)"
echo ""
