#!/bin/sh
set -e
echo "[start-prod] Running database migrations..."
node artifacts/api-server/dist/migrate.mjs
echo "[start-prod] Migrations complete. Starting API server..."
exec node --enable-source-maps artifacts/api-server/dist/index.mjs
