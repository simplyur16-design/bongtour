#!/bin/sh
# Railway preDeploy — never block the release.
# Pending schema changes can be applied after the new process starts and frees
# Supabase session-pool slots (EMAXCONNSESSION).
set +e

echo "[predeploy] start"

if [ -n "${DIRECT_URL:-}" ]; then
  case "$DIRECT_URL" in
    *pooler.supabase.com*|*pooler.supabase.co*)
      echo "[predeploy] WARN: DIRECT_URL points at the Supabase pooler — migrate needs db.<ref>.supabase.co:5432"
      ;;
  esac
fi

# One quick migrate attempt. Pool saturation / any failure must not stop deploy.
echo "[predeploy] prisma migrate deploy (best-effort, 1 attempt)"
migrate_out="$(npx prisma migrate deploy 2>&1)"
migrate_status=$?
printf '%s\n' "$migrate_out"
if [ "$migrate_status" -ne 0 ]; then
  echo "[predeploy] WARN: migrate exit=$migrate_status — continuing deploy anyway"
  echo "[predeploy] WARN: after the new release is up, run: npx prisma migrate deploy"
fi

echo "[predeploy] postdeploy:detail-payload (best-effort)"
npm run postdeploy:detail-payload
if [ $? -ne 0 ]; then
  echo "[predeploy] WARN: postdeploy:detail-payload failed — non-blocking"
fi

echo "[predeploy] done (always exit 0)"
exit 0
