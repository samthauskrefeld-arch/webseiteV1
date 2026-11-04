#!/usr/bin/env bash
# Stellt ein Backup in eine (neue, leere) Zieldatenbank wieder her.
#   TARGET_DATABASE_URL=... ./scripts/restore.sh backups/myminijob-....dump
set -euo pipefail
: "${TARGET_DATABASE_URL:?TARGET_DATABASE_URL fehlt}"
FILE="${1:?Pfad zum Backup fehlt}"
[ -f "$FILE.sha256" ] && sha256sum -c "$FILE.sha256"
pg_restore --no-owner --no-privileges --exit-on-error --dbname="$TARGET_DATABASE_URL" "$FILE"
echo "Wiederhergestellt: $FILE"
