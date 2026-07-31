#!/bin/sh
# Railway preDeploy — migrate + light postdeploy.
# Supabase session pool saturation (EMAXCONNSESSION) must not block shipping a
# release that lowers connection usage; retry, then soft-fail so the new
# process can start and free the pool.
set -u

is_pool_saturated() {
  printf '%s' "$1" | grep -Eqi 'EMAXCONNSESSION|max clients reached|too many clients|remaining connection slots|53300'
}

if [ -n "${DIRECT_URL:-}" ]; then
  case "$DIRECT_URL" in
    *pooler.supabase.com*|*pooler.supabase.co*)
      echo "[predeploy] WARN: DIRECT_URL points at the Supabase pooler."
      echo "[predeploy] WARN: Schema engine needs the direct host (db.<ref>.supabase.co:5432)."
      ;;
  esac
fi

attempts=8
i=1
migrate_ok=0
while [ "$i" -le "$attempts" ]; do
  echo "[predeploy] prisma migrate deploy (attempt $i/$attempts)"
  out="$(npx prisma migrate deploy 2>&1)" && {
    printf '%s\n' "$out"
    migrate_ok=1
    break
  }
  status=$?
  printf '%s\n' "$out"
  if is_pool_saturated "$out"; then
    wait_s=$((i * 8))
    echo "[predeploy] pool saturated (EMAXCONNSESSION) — wait ${wait_s}s then retry"
    sleep "$wait_s"
    i=$((i + 1))
    continue
  fi
  echo "[predeploy] migrate failed (exit $status) — not a pooler saturation error"
  exit "$status"
done

if [ "$migrate_ok" -ne 1 ]; then
  echo "[predeploy] WARN: migrate still blocked by pool saturation after $attempts attempts."
  echo "[predeploy] WARN: continuing deploy so the new lower connection_limit can start and free slots."
  echo "[predeploy] WARN: re-run 'npx prisma migrate deploy' once the pool has headroom."
fi

echo "[predeploy] postdeploy:detail-payload (best-effort)"
if ! npm run postdeploy:detail-payload; then
  echo "[predeploy] WARN: postdeploy:detail-payload failed — non-blocking"
fi

exit 0
