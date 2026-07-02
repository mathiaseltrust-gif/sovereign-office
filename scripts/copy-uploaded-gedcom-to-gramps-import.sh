#!/usr/bin/env bash
set -euo pipefail

cd "${1:-$HOME/sovereign-office}"
mkdir -p gramps-import

SRC="${2:-}"
if [ -z "$SRC" ]; then
  echo "Usage: bash scripts/copy-uploaded-gedcom-to-gramps-import.sh ~/sovereign-office /path/to/tree.ged"
  echo "Then import the copied .ged file from the Gramps Web UI."
  exit 1
fi

if [ ! -f "$SRC" ]; then
  echo "GEDCOM file not found: $SRC"
  exit 1
fi

cp "$SRC" "gramps-import/$(basename "$SRC")"
echo "Copied GEDCOM to $PWD/gramps-import/$(basename "$SRC")"
