#!/bin/bash
#
# 195x Bench App — production Postgres → Cloudflare R2 backup
#
# Reads secrets from macOS Keychain so nothing sensitive lives on disk.
# Designed to run from cron on a Mac (e.g. an always-on Mac Studio).
#
# Required Keychain entries (set with `security add-generic-password`):
#   service: 195x-bench-backup
#   accounts:
#     - DATABASE_URL          (Replit prod Postgres connection string)
#     - R2_ACCESS_KEY_ID      (Cloudflare R2 API token access key)
#     - R2_SECRET_ACCESS_KEY  (Cloudflare R2 API token secret)
#
# Required external tools (install via `brew install postgresql awscli`):
#   - pg_dump
#   - aws

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────────
SERVICE="195x-bench-backup"
R2_BUCKET="195x-bench-backups"
R2_ENDPOINT="https://4d0de76b25b1b93b4eb7c8f339916114.r2.cloudflarestorage.com"
RETENTION_DAYS=30

LOG_DIR="$HOME/scripts/logs"
LOG_FILE="$LOG_DIR/195x-backup.log"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$LOG_DIR"

# ── Logging helper ──────────────────────────────────────────────────────────
log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$LOG_FILE"
}

fail() {
  log "ERROR: $*"
  exit 1
}

# ── Read secrets from Keychain ──────────────────────────────────────────────
get_secret() {
  local account="$1"
  security find-generic-password -s "$SERVICE" -a "$account" -w 2>/dev/null \
    || fail "Missing Keychain entry: service=$SERVICE account=$account"
}

DATABASE_URL="$(get_secret DATABASE_URL)"
export AWS_ACCESS_KEY_ID="$(get_secret R2_ACCESS_KEY_ID)"
export AWS_SECRET_ACCESS_KEY="$(get_secret R2_SECRET_ACCESS_KEY)"
# R2 doesn't use a region but the AWS CLI requires one to be set.
export AWS_DEFAULT_REGION="auto"

# ── Dump ────────────────────────────────────────────────────────────────────
TIMESTAMP="$(date '+%Y-%m-%d_%H%M%S')"
DUMP_FILE="$TMP_DIR/195x-bench-prod-$TIMESTAMP.dump"

log "Starting backup → $DUMP_FILE"
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="$DUMP_FILE" \
  || fail "pg_dump failed"

DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
log "Dump complete ($DUMP_SIZE)"

# ── Upload ──────────────────────────────────────────────────────────────────
S3_KEY="daily/195x-bench-prod-$TIMESTAMP.dump"
log "Uploading to r2://$R2_BUCKET/$S3_KEY"

aws s3 cp "$DUMP_FILE" "s3://$R2_BUCKET/$S3_KEY" \
  --endpoint-url "$R2_ENDPOINT" \
  --no-progress \
  || fail "R2 upload failed"

log "Upload complete"

# ── Retention cleanup ───────────────────────────────────────────────────────
# Delete daily/ objects older than RETENTION_DAYS days. R2 doesn't support
# server-side lifecycle rules via S3 API the same way AWS does, so we list
# and delete client-side.
CUTOFF=$(date -v-${RETENTION_DAYS}d '+%Y-%m-%d')
log "Pruning dumps older than $CUTOFF"

PRUNED=0
while IFS= read -r line; do
  # aws s3 ls output: "2026-03-01 03:00:00   1234567 daily/195x-bench-prod-2026-03-01_030000.dump"
  obj_date=$(echo "$line" | awk '{print $1}')
  obj_key=$(echo "$line" | awk '{print $4}')
  if [[ -z "$obj_key" ]]; then continue; fi
  if [[ "$obj_date" < "$CUTOFF" ]]; then
    aws s3 rm "s3://$R2_BUCKET/$obj_key" \
      --endpoint-url "$R2_ENDPOINT" \
      > /dev/null
    PRUNED=$((PRUNED + 1))
  fi
done < <(aws s3 ls "s3://$R2_BUCKET/daily/" --endpoint-url "$R2_ENDPOINT" 2>/dev/null || true)

log "Pruned $PRUNED old dump(s)"
log "Backup complete: $S3_KEY ($DUMP_SIZE)"
