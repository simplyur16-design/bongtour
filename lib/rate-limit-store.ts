type BucketValue = { count: number; resetAt: number }

export type RateLimitStoreKind = "memory" | "redis"

export interface RateLimitStore {
  incr(key: string, windowMs: number): Promise<BucketValue>
  kind: RateLimitStoreKind
}

type GlobalRateLimitStore = typeof globalThis & {
  __bongtourRateLimitStore?: RateLimitStore
  __bongtourRateLimitMemoryMap?: Map<string, BucketValue>
}

let warnedEdgeRedis = false

function isEdgeRuntime(): boolean {
  return process.env.NEXT_RUNTIME === "edge"
}

function sanitizeRedisKeyPart(s: string): string {
  return s.replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 180)
}

function createMemoryStore(): RateLimitStore {
  return {
    kind: "memory",
    async incr(key: string, windowMs: number) {
      const now = Date.now()
      const g = globalThis as GlobalRateLimitStore
      if (!g.__bongtourRateLimitMemoryMap) g.__bongtourRateLimitMemoryMap = new Map()
      const prev = g.__bongtourRateLimitMemoryMap.get(key)
      if (!prev || prev.resetAt <= now) {
        const fresh = { count: 1, resetAt: now + windowMs }
        g.__bongtourRateLimitMemoryMap.set(key, fresh)
        return fresh
      }
      const next = { ...prev, count: prev.count + 1 }
      g.__bongtourRateLimitMemoryMap.set(key, next)
      return next
    },
  }
}

function createRedisStore(url: string): RateLimitStore {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const IORedis = require("ioredis") as typeof import("ioredis").default
  const client = new IORedis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableOfflineQueue: false,
  })
  return {
    kind: "redis",
    async incr(key: string, windowMs: number) {
      const redisKey = `bongtour:rl:v1:${sanitizeRedisKeyPart(key)}`
      const n = await client.incr(redisKey)
      if (n === 1) await client.pexpire(redisKey, windowMs)
      const pttl = await client.pttl(redisKey)
      const resetAt = Date.now() + (pttl > 0 ? pttl : windowMs)
      return { count: n, resetAt }
    },
  }
}

/**
 * Rate limit 저장소.
 * - Edge(미들웨어): 항상 메모리.
 * - Node: REDIS_URL 또는 BONGTOUR_REDIS_URL 이 있으면 Redis, 없으면 메모리.
 */
export function getRateLimitStore(): RateLimitStore {
  const g = globalThis as GlobalRateLimitStore
  if (g.__bongtourRateLimitStore) return g.__bongtourRateLimitStore

  const redisUrl = (process.env.REDIS_URL ?? process.env.BONGTOUR_REDIS_URL ?? "").trim()

  if (isEdgeRuntime()) {
    if (redisUrl && !warnedEdgeRedis) {
      warnedEdgeRedis = true
      console.warn(
        "[rate-limit-store] Edge에서는 Redis(ioredis) 미사용, 이 격리 내 메모리 카운터만 사용."
      )
    }
    g.__bongtourRateLimitStore = createMemoryStore()
    return g.__bongtourRateLimitStore
  }

  if (redisUrl) {
    try {
      g.__bongtourRateLimitStore = createRedisStore(redisUrl)
      console.info("[rate-limit-store] Node: Redis store (ioredis)")
    } catch (e) {
      console.error("[rate-limit-store] Redis init failed, memory fallback:", e)
      g.__bongtourRateLimitStore = createMemoryStore()
      console.info("[rate-limit-store] Node: memory store (Redis init failed)")
    }
  } else {
    g.__bongtourRateLimitStore = createMemoryStore()
    console.info("[rate-limit-store] Node: memory store (set REDIS_URL or BONGTOUR_REDIS_URL for Redis)")
  }

  return g.__bongtourRateLimitStore
}
