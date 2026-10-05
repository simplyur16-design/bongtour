/**
 * Prisma pooler connection_limit SSOT.
 *
 * Supabase session pool is capped (often pool_size 15). Prisma + `lib/bongsim/db/pool`
 * must not fill that alone — and Prisma must prefer the transaction pooler (`:6543`)
 * so it does not compete for session slots at all.
 */
import { shouldSkipDbAtBuild } from '@/lib/build-time-db'
import {
  ensurePrismaPgBouncerFlag,
  rewriteSupabaseSessionPoolerToTransaction,
} from '@/lib/supabase-pooler-url'

const BUILD_SAFE_DEFAULT = 1
const PRODUCTION_DEFAULT = 3
/** worker 배치는 web(eSIM·홈)보다 낮게 — Supabase session/transaction 여유 확보 */
const PRODUCTION_WORKER_DEFAULT = 2

function isWorkerInstrumentationRole(): boolean {
  const explicit = process.env.BONGTOUR_INSTRUMENTATION_ROLE?.trim().toLowerCase()
  if (explicit === 'worker' || explicit === 'cron') return true
  const serviceName = (process.env.RAILWAY_SERVICE_NAME ?? '').trim().toLowerCase()
  return serviceName.includes('worker') || serviceName.includes('cron')
}

export function resolvePrismaConnectionLimit(): number {
  if (shouldSkipDbAtBuild()) return 1
  const raw = process.env.BONGTOUR_PRISMA_CONNECTION_LIMIT?.trim()
  if (raw) {
    const n = parseInt(raw, 10)
    if (Number.isFinite(n) && n >= 1 && n <= 20) return n
  }
  if (process.env.NODE_ENV === 'production') {
    // REGRESSION-FREEZE[register-pre-photo-ingest-db-budget]: worker Prisma 2 — manifest
    if (isWorkerInstrumentationRole()) return PRODUCTION_WORKER_DEFAULT
    return PRODUCTION_DEFAULT
  }
  return BUILD_SAFE_DEFAULT
}

/**
 * Read-replica / DATABASE_URL_READ pool budget.
 * Falls back to write limit when unset so replica can be plugged in later without code churn.
 * REGRESSION-FREEZE[prisma-read-write-split]: read limit env — manifest
 */
export function resolvePrismaReadConnectionLimit(): number {
  if (shouldSkipDbAtBuild()) return 1
  const raw = process.env.BONGTOUR_PRISMA_READ_CONNECTION_LIMIT?.trim()
  if (raw) {
    const n = parseInt(raw, 10)
    if (Number.isFinite(n) && n >= 1 && n <= 20) return n
  }
  return resolvePrismaConnectionLimit()
}

function appendQueryParam(url: string, key: string, value: string): string {
  if (new RegExp(`[?&]${key}=`, 'i').test(url)) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}${key}=${value}`
}

export function withPrismaConnectionLimit(
  databaseUrl: string | undefined,
  options?: { limit?: number },
): string | undefined {
  if (!databaseUrl) return databaseUrl
  // Session-mode pooler URLs are what produce EMAXCONNSESSION under load.
  let url = rewriteSupabaseSessionPoolerToTransaction(databaseUrl.trim())
  url = ensurePrismaPgBouncerFlag(url)
  const limit = options?.limit ?? resolvePrismaConnectionLimit()
  url = appendQueryParam(url, 'connection_limit', String(limit))
  return url
}
