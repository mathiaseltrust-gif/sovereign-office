#!/usr/bin/env bash
set -euo pipefail

cd "${1:-$HOME/sovereign-office}"

mkdir -p data/gramps-import

echo "Starting Gramps Web standalone stack on host port 5010..."
sudo docker compose -f docker-compose.gramps.yml pull
sudo docker compose -f docker-compose.gramps.yml up -d

echo
echo "Gramps Web containers:"
sudo docker compose -f docker-compose.gramps.yml ps

echo
echo "Open Gramps Web: http://office.mathiaseltribe.org:5010"
echo "Use the first-run wizard to create the owner account, then import the Ancestry GEDCOM file."
