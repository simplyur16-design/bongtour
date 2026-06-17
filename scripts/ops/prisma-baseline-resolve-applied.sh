#!/usr/bin/env bash
# Baseline: mark all existing prisma/migrations as applied (no DDL replay).
# Prerequisites:
#   - DIRECT_URL set (Supabase direct 5432, not pooler duplicate)
#   - _prisma_migrations empty or absent
#   - Spot-check passed for Prisma-only migrations
#
# Usage:
#   railway run --service bongtour bash scripts/ops/prisma-baseline-resolve-applied.sh
#   # or locally with .env containing DATABASE_URL + DIRECT_URL:
#   bash scripts/ops/prisma-baseline-resolve-applied.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [[ ! -d prisma/migrations ]]; then
  echo "prisma/migrations not found" >&2
  exit 1
fi

mapfile -t MIGRATIONS < <(
  find prisma/migrations -mindepth 1 -maxdepth 1 -type d \
    ! -name migration_lock.toml \
    -exec test -f '{}/migration.sql' ';' -print \
  | sed 's|.*/||' \
  | sort
)

COUNT="${#MIGRATIONS[@]}"
echo "Resolving ${COUNT} migrations as applied..."

i=0
for name in "${MIGRATIONS[@]}"; do
  i=$((i + 1))
  echo "[$i/${COUNT}] prisma migrate resolve --applied \"${name}\""
  npx prisma migrate resolve --applied "${name}"
done

echo "Done. Verify with: npx prisma migrate status"
