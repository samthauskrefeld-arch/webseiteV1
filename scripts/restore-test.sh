#!/usr/bin/env bash
# Restore-Test: Backup erstellen, in Wegwerf-DB wiederherstellen, Zeilenzahlen und Migrationsstand vergleichen.
#   DATABASE_URL=... ./scripts/restore-test.sh
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL fehlt}"
TMP=$(mktemp -d)
FILE=$(./scripts/backup.sh "$TMP")
BASE="${DATABASE_URL%/*}"
TARGET_DB="mmj_restore_test_$$"
psql "$BASE/postgres" -qc "DROP DATABASE IF EXISTS $TARGET_DB" -c "CREATE DATABASE $TARGET_DB"
TARGET_DATABASE_URL="$BASE/$TARGET_DB" ./scripts/restore.sh "$FILE" >/dev/null
Q='SELECT (SELECT count(*) FROM "User")||'"'"'/'"'"'||(SELECT count(*) FROM "Listing")||'"'"'/'"'"'||(SELECT count(*) FROM "Invoice")||'"'"'/'"'"'||(SELECT count(*) FROM "Qualification")||'"'"'/'"'"'||(SELECT count(*) FROM "_prisma_migrations")'
SRC=$(psql "$DATABASE_URL" -tAc "$Q")
DST=$(psql "$BASE/$TARGET_DB" -tAc "$Q")
psql "$BASE/postgres" -qc "DROP DATABASE $TARGET_DB"
rm -rf "$TMP"
if [ "$SRC" = "$DST" ]; then echo "Restore-Test OK (User/Listing/Invoice/Qualification/Migrationen: $SRC)"; else echo "Restore-Test FEHLGESCHLAGEN: $SRC != $DST"; exit 1; fi
