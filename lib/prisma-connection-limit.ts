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

function appendQueryParam(url: string, key: string, value: string): string {
  if (new RegExp(`[?&]${key}=`, 'i').test(url)) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}${key}=${value}`
}

export function withPrismaConnectionLimit(databaseUrl: string | undefined): string | undefined {
  if (!databaseUrl) return databaseUrl
  // Session-mode pooler URLs are what produce EMAXCONNSESSION under load.
  let url = rewriteSupabaseSessionPoolerToTransaction(databaseUrl.trim())
  url = ensurePrismaPgBouncerFlag(url)
  url = appendQueryParam(url, 'connection_limit', String(resolvePrismaConnectionLimit()))
  return url
}
