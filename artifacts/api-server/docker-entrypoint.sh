#!/bin/sh
set -e

echo "[entrypoint] Running database migrations..."
node /app/dist/migrate.mjs
echo "[entrypoint] Migrations complete — starting server..."
exec node --enable-source-maps /app/dist/index.mjs
