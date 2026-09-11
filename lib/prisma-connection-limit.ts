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

export function resolvePrismaConnectionLimit(): number {
  if (shouldSkipDbAtBuild()) return 1
  const raw = process.env.BONGTOUR_PRISMA_CONNECTION_LIMIT?.trim()
  if (raw) {
    const n = parseInt(raw, 10)
    if (Number.isFinite(n) && n >= 1 && n <= 20) return n
  }
  if (process.env.NODE_ENV === 'production') return PRODUCTION_DEFAULT
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
