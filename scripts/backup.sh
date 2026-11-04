#!/usr/bin/env bash
# Logisches Backup der Datenbank (Custom-Format, komprimiert).
#   DATABASE_URL=... ./scripts/backup.sh [zielordner]
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL fehlt}"
DIR="${1:-./backups}"
mkdir -p "$DIR"
FILE="$DIR/myminijob-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --format=custom --no-owner --no-privileges --dbname="$DATABASE_URL" --file="$FILE"
sha256sum "$FILE" > "$FILE.sha256"
echo "$FILE"
