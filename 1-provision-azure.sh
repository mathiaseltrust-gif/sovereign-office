#!/usr/bin/env bash
# =============================================================================
# Sovereign Office — Step 1: Provision Azure Resources
# Wrapper — delegates to deploy-package/1-provision-azure.sh
# =============================================================================
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/deploy-package/1-provision-azure.sh" "$@"
