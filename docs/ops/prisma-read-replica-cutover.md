# Phase 2 — spuptil Read Replica (on-demand)

Do **not** provision until Phase 0/1 still show pool pressure under normal sweeps.

## Steps

1. Supabase project `spuptilbzyxrvyyyheza` → add **Read Replica** (confirm plan/cost).
2. Copy replica **Transaction pooler** URI (`:6543`, `pgbouncer=true` friendly).
3. Railway `bongtour-worker` only (`--skip-deploys`):

```env
DATABASE_URL=<primary txn pooler>          # writes; BONGTOUR_PRISMA_CONNECTION_LIMIT=2
DATABASE_URL_READ=<replica txn pooler>
BONGTOUR_PRISMA_READ_CONNECTION_LIMIT=2
DISABLE_INSTRUMENTATION_PUBLISH_REMINDER_CRON=1
```

4. Restart worker **without** scale/build spam (redeploy existing image / rollback pattern).
5. Confirm logs: sweeps still upsert on primary; due-select uses read URL.
6. Leave **web** on primary only (no `DATABASE_URL_READ`).

## Rollback

Unset `DATABASE_URL_READ` on worker → `prismaRead` aliases write again.
