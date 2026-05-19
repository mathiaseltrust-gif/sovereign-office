#!/usr/bin/env bash
# =============================================================================
# Sovereign Office — Step 2: Build and Push Docker Images
# Wrapper — delegates to deploy-package/2-build-push.sh
# Run from the repo root:  bash 2-build-push.sh
# =============================================================================
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/deploy-package/2-build-push.sh" "$@"
