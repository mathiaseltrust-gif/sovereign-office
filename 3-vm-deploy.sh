#!/usr/bin/env bash
# =============================================================================
# Sovereign Office — Step 3: Deploy on the Azure VM
# Wrapper — delegates to deploy-package/3-vm-deploy.sh
# Run this ON YOUR AZURE VM after copying the deploy-package/ folder there.
# =============================================================================
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/deploy-package/3-vm-deploy.sh" "$@"
