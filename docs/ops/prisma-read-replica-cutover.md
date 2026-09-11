# Phase 2 — spuptil Read Replica (on-demand)

Do **not** provision until Phase 0/1 still show pool pressure under normal sweeps.

## Steps

1. Supabase project `spuptilbzyxrvyyyheza` → add **Read Replica** in **ap-northeast-2** (confirm plan/cost). Wait until **Healthy**.
2. Prefer **Shared Transaction pooler** (IPv4), not the `db.*-rr-*.supabase.co` direct host (often IPv6-only → ENOTFOUND from Railway/Windows).
   - User looks like `postgres.<project>-rr-<region>-<id>`
   - Host `aws-1-ap-northeast-2.pooler.supabase.com:6543`
   - Verify with `select pg_is_in_recovery()` → `true`
3. Railway `bongtour-worker` only (`skip_deploys` when setting vars):

```env
DATABASE_URL=<primary txn pooler>          # writes; BONGTOUR_PRISMA_CONNECTION_LIMIT=2
DATABASE_URL_READ=<replica txn pooler + pgbouncer=true>
BONGTOUR_PRISMA_READ_CONNECTION_LIMIT=2
DISABLE_INSTRUMENTATION_PUBLISH_REMINDER_CRON=1
```

4. Restart/scale worker **southeast-asia=1** only (US-West=0). Prefer restart over full rebuild when possible.
5. Confirm: due-select via `prismaRead` / replica; upserts on primary; eSIM/browse still 200.
6. Leave **web** on primary only (no `DATABASE_URL_READ`).

**Status (2026-09-11):** worker `DATABASE_URL_READ` pointed at Seoul RR pooler; lean cron flags kept.

## Rollback

Unset `DATABASE_URL_READ` on worker → `prismaRead` aliases write again.
