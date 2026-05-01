import { getRateLimitStore } from "@/lib/rate-limit-store"
import { notifySecurityAnomaly } from '@/lib/security-anomaly-notifier'

type Bucket = { count: number; resetAt: number }
type EventBucket = { unauthorized: number; forbidden: number; limited: number; expensive: number; resetAt: number }

type GlobalSec = typeof globalThis & {
  __bongtourAnomalyBuckets?: Map<string, EventBucket>
}

export type AdminApiClass = 'read' | 'write' | 'expensive'

const POLICIES: Record<AdminApiClass, { windowMs: number; max: number }> = {
  read: { windowMs: 60_000, max: 180 },
  write: { windowMs: 60_000, max: 90 },
  expensive: { windowMs: 60_000, max: 30 },
}

export function getClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() || 'unknown'
  return headers.get('x-real-ip') || 'unknown'
}

export function classifyAdminApi(pathname: string, method: string): AdminApiClass {
  const m = method.toUpperCase()
  const expensiveHints = ['/gemini/', '/convert-to-webp', '/process-images', '/photo-pool/upload', '/scheduler/run-once']
  if (expensiveHints.some((h) => pathname.includes(h))) return 'expensive'
  if (m === 'GET' || m === 'HEAD') return 'read'
  return 'write'
}

/**
 * 미들웨어(Edge): `getRateLimitStore()` → kind `memory` 고정.
 * Node API: REDIS_URL / BONGTOUR_REDIS_URL 있으면 Redis, 없으면 memory (`store.kind` 참고).
 */
export async function checkAdminApiRateLimit(ip: string, cls: AdminApiClass): Promise<{ limited: boolean; retryAfterSec: number }> {
  const now = Date.now()
  const policy = POLICIES[cls]
  const store = getRateLimitStore()
  const key = `${cls}:${ip}:${Math.floor(now / policy.windowMs)}`
  const prev: Bucket = await store.incr(key, policy.windowMs)
  return {
    limited: prev.count > policy.max,
    retryAfterSec: Math.max(1, Math.ceil((prev.resetAt - now) / 1000)),
  }
}

export function recordAdminApiSecurityEvent(ip: string, event: '401' | '403' | '429' | 'expensive', pathname: string) {
  const now = Date.now()
  const g = globalThis as GlobalSec
  if (!g.__bongtourAnomalyBuckets) g.__bongtourAnomalyBuckets = new Map()
  const key = `${ip}:${Math.floor(now / 60_000)}`
  const prev = g.__bongtourAnomalyBuckets.get(key) ?? { unauthorized: 0, forbidden: 0, limited: 0, expensive: 0, resetAt: now + 60_000 }
  if (event === '401') prev.unauthorized += 1
  if (event === '403') prev.forbidden += 1
  if (event === '429') prev.limited += 1
  if (event === 'expensive') prev.expensive += 1
  g.__bongtourAnomalyBuckets.set(key, prev)

  if (prev.unauthorized >= 10 || prev.forbidden >= 8 || prev.limited >= 8 || prev.expensive >= 20) {
    const payload = {
      ip,
      path: pathname,
      unauthorized: prev.unauthorized,
      forbidden: prev.forbidden,
      limited: prev.limited,
      expensive: prev.expensive,
    }
    console.warn('[admin-api-security-anomaly]', payload)
    void notifySecurityAnomaly(payload)
  }
}

