#!/usr/bin/env bash
# =============================================================================
# setup-backup-cron.sh — Install the nightly backup cron job on an Azure VM
#
# Run once on the server after cloning the repository:
#   sudo ./scripts/setup-backup-cron.sh
#
# What it does:
#   1. Installs azure-cli and postgresql-client if missing.
#   2. Creates /etc/cron.d/sovereign-backup that runs backup.sh every night
#      at 02:00 UTC and appends to /var/log/sovereign-backup.log.
#   3. Prints the next few scheduled run times for confirmation.
# =============================================================================

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_SCRIPT="${REPO_DIR}/scripts/backup.sh"
LOG_FILE="/var/log/sovereign-backup.log"
CRON_FILE="/etc/cron.d/sovereign-backup"
CRON_USER="${SUDO_USER:-root}"
ENV_FILE="${REPO_DIR}/.env"

# ---------------------------------------------------------------------------
# Must be run as root (to write to /etc/cron.d)
# ---------------------------------------------------------------------------
if [[ $EUID -ne 0 ]]; then
  echo "ERROR: run this script with sudo." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# 1. Install dependencies
# ---------------------------------------------------------------------------
echo "[setup] checking dependencies..."

if ! command -v az &>/dev/null; then
  echo "[setup] installing azure-cli..."
  curl -sL https://aka.ms/InstallAzureCLIDeb | bash
fi

if ! command -v pg_dump &>/dev/null; then
  echo "[setup] installing postgresql-client..."
  apt-get install -y postgresql-client
fi

echo "[setup] dependencies OK"

# ---------------------------------------------------------------------------
# 2. Make backup script executable
# ---------------------------------------------------------------------------
chmod +x "$BACKUP_SCRIPT"

# ---------------------------------------------------------------------------
# 3. Create the cron job
#    - Runs at 02:00 UTC every day
#    - Loads environment variables from .env before executing
#    - Logs stdout+stderr to /var/log/sovereign-backup.log
# ---------------------------------------------------------------------------
touch "$LOG_FILE"
chown "$CRON_USER" "$LOG_FILE"

cat > "$CRON_FILE" <<CRON
# Sovereign Office — nightly PostgreSQL backup to Azure Blob Storage
# Runs at 02:00 UTC daily.  Retention: 30 days (set BACKUP_RETENTION_DAYS to override).
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

0 2 * * * ${CRON_USER} set -a && . ${ENV_FILE} && set +a && ${BACKUP_SCRIPT} >> ${LOG_FILE} 2>&1
CRON

chmod 644 "$CRON_FILE"

echo "[setup] cron job written to ${CRON_FILE}"
echo "[setup] logs will be written to ${LOG_FILE}"
echo ""
echo "Verify with:  crontab -l  OR  cat ${CRON_FILE}"
echo "Test a manual run with:  sudo -E ${BACKUP_SCRIPT}"
