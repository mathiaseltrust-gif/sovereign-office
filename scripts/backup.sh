#!/usr/bin/env bash
# =============================================================================
# backup.sh — Nightly PostgreSQL backup to Azure Blob Storage
#
# Usage:
#   ./scripts/backup.sh
#
# Required environment variables (set in .env or export before running):
#   DATABASE_URL               PostgreSQL connection string
#   AZURE_STORAGE_ACCOUNT      Azure Storage account name
#   AZURE_STORAGE_KEY          Azure Storage account key  (or use SAS token)
#   AZURE_BACKUP_CONTAINER     Blob container name (e.g. "db-backups")
#
# Optional:
#   BACKUP_RETENTION_DAYS      How many days to keep (default: 30)
#   BACKUP_DIR                 Local temp directory    (default: /tmp/pg-backups)
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
BACKUP_DIR="${BACKUP_DIR:-/tmp/pg-backups}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP_FILE="${BACKUP_DIR}/sovereign_office_${TIMESTAMP}.dump"

# ---------------------------------------------------------------------------
# Validate required variables
# ---------------------------------------------------------------------------
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${AZURE_STORAGE_ACCOUNT:?AZURE_STORAGE_ACCOUNT is required}"
: "${AZURE_STORAGE_KEY:?AZURE_STORAGE_KEY is required}"
: "${AZURE_BACKUP_CONTAINER:?AZURE_BACKUP_CONTAINER is required}"

# ---------------------------------------------------------------------------
# Ensure local temp directory exists
# ---------------------------------------------------------------------------
mkdir -p "$BACKUP_DIR"

echo "[backup] $(date -u +%FT%TZ) — starting backup"

# ---------------------------------------------------------------------------
# 1. Dump the database
# ---------------------------------------------------------------------------
echo "[backup] running pg_dump → ${DUMP_FILE}"
pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-acl \
  --format=custom \
  --file="$DUMP_FILE"

DUMP_SIZE="$(du -sh "$DUMP_FILE" | cut -f1)"
echo "[backup] dump complete — size: ${DUMP_SIZE}"

# ---------------------------------------------------------------------------
# 2. Upload to Azure Blob Storage
# ---------------------------------------------------------------------------
BLOB_NAME="$(basename "$DUMP_FILE")"
echo "[backup] uploading to az://${AZURE_BACKUP_CONTAINER}/${BLOB_NAME}"

az storage blob upload \
  --account-name "$AZURE_STORAGE_ACCOUNT" \
  --account-key  "$AZURE_STORAGE_KEY" \
  --container-name "$AZURE_BACKUP_CONTAINER" \
  --name "$BLOB_NAME" \
  --file "$DUMP_FILE" \
  --overwrite \
  --output none

echo "[backup] upload complete"

# ---------------------------------------------------------------------------
# 3. Remove the local dump file (it now lives in blob storage)
# ---------------------------------------------------------------------------
rm -f "$DUMP_FILE"
echo "[backup] local temp file removed"

# ---------------------------------------------------------------------------
# 4. Enforce retention — delete blobs older than RETENTION_DAYS
# ---------------------------------------------------------------------------
echo "[backup] enforcing ${RETENTION_DAYS}-day retention policy"

CUTOFF="$(date -u -d "-${RETENTION_DAYS} days" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
  || date -u -v-${RETENTION_DAYS}d +%Y-%m-%dT%H:%M:%SZ)"   # macOS fallback

az storage blob list \
  --account-name "$AZURE_STORAGE_ACCOUNT" \
  --account-key  "$AZURE_STORAGE_KEY" \
  --container-name "$AZURE_BACKUP_CONTAINER" \
  --query "[?properties.lastModified < '${CUTOFF}'].name" \
  --output tsv | while read -r OLD_BLOB; do
    if [[ -n "$OLD_BLOB" ]]; then
      echo "[backup] deleting old blob: ${OLD_BLOB}"
      az storage blob delete \
        --account-name "$AZURE_STORAGE_ACCOUNT" \
        --account-key  "$AZURE_STORAGE_KEY" \
        --container-name "$AZURE_BACKUP_CONTAINER" \
        --name "$OLD_BLOB" \
        --output none
    fi
  done

echo "[backup] $(date -u +%FT%TZ) — backup finished successfully"
