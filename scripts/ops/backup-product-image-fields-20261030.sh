#!/usr/bin/env bash
# Backup of the "Product" table BEFORE applying migration 20261030200000_product_bg_image_ai_label.
# NOT run automatically. Run by hand (owner-approved stage-4 deploy only), from a machine that has DATABASE_URL in its env.
# Never echoes the connection string. Output: ./backups/product-before-ai-label-<UTC stamp>.dump (pg_dump custom format, data+schema of "Product" only).
#
#   bash scripts/ops/backup-product-image-fields-20261030.sh
#   # restore check (no write):  pg_restore --list backups/product-before-ai-label-*.dump | head
#
# REGRESSION-FREEZE[product-image-stage4-1030]: backup before additive migration — manifest
set -euo pipefail
if [ -z "${DATABASE_URL:-}" ]; then
  echo "[backup] DATABASE_URL not set in env — stop (nothing written)" >&2
  exit 2
fi
command -v pg_dump >/dev/null 2>&1 || { echo "[backup] pg_dump not found — stop" >&2; exit 2; }
mkdir -p backups
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="backups/product-before-ai-label-${stamp}.dump"
# Prisma-style ?schema=/pgbouncer params are not understood by pg_dump → strip query string.
url="${DATABASE_URL%%\?*}"
PGSSLMODE="${PGSSLMODE:-require}" pg_dump --format=custom --no-owner --no-privileges \
  --table='public."Product"' --file="$out" "$url" 2> >(sed -E 's#postgres(ql)?://[^ ]+#[redacted]#g' >&2)
size="$(wc -c < "$out" | tr -d ' ')"
if [ "${size:-0}" -lt 1024 ]; then
  echo "[backup] dump too small (${size} bytes) — treat as FAILED, do not apply migration" >&2
  exit 1
fi
echo "[backup] OK ${out} (${size} bytes)"
