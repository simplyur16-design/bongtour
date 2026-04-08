type BucketValue = { count: number; resetAt: number }

export interface RateLimitStore {
  incr(key: string, windowMs: number): Promise<BucketValue>
  kind: 'memory'
}

type GlobalRateLimitStore = typeof globalThis & {
  __bongtourRateLimitStore?: RateLimitStore
  __bongtourRateLimitMemoryMap?: Map<string, BucketValue>
}

function createMemoryStore(): RateLimitStore {
  return {
    kind: 'memory',
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

export function getRateLimitStore(): RateLimitStore {
  const g = globalThis as GlobalRateLimitStore
  if (g.__bongtourRateLimitStore) return g.__bongtourRateLimitStore

  g.__bongtourRateLimitStore = createMemoryStore()
  return g.__bongtourRateLimitStore
}
