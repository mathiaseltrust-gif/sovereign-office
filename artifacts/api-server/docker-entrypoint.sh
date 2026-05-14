#!/bin/sh
set -e

echo "[entrypoint] Running database migrations..."
node /app/dist/migrate.mjs
echo "[entrypoint] Migrations complete."

echo "[entrypoint] Running family tree seed..."
node /app/dist/seed.mjs
echo "[entrypoint] Seed complete — starting server..."

exec node --enable-source-maps /app/dist/index.mjs
