#!/usr/bin/env bash
set -euo pipefail

cd "${1:-$HOME/sovereign-office}"
mkdir -p gramps-import

if ! grep -q '^GRAMPSWEB_SECRET_KEY=' .env 2>/dev/null; then
  echo "GRAMPSWEB_SECRET_KEY=$(openssl rand -hex 32)" >> .env
fi

if ! grep -q '^GRAMPSWEB_BASE_URL=' .env 2>/dev/null; then
  SERVER_IP=$(hostname -I | awk '{print $1}')
  echo "GRAMPSWEB_BASE_URL=http://${SERVER_IP}:5050" >> .env
fi

echo "Starting Gramps Web sidecar on host port 5050..."
sudo docker compose --env-file .env -f docker-compose.gramps-web.yml pull
sudo docker compose --env-file .env -f docker-compose.gramps-web.yml up -d

echo
sudo docker compose --env-file .env -f docker-compose.gramps-web.yml ps

echo
echo "Open Gramps Web on host port 5050."
echo "GEDCOM import folder on VM: $PWD/gramps-import"
