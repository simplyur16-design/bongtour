import { describe, expect, it, vi } from 'vitest'
import { hubBrowsePrefetchWithTimeout } from '@/lib/products-browse-hub-prefetch-timeout'

describe('hubBrowsePrefetchWithTimeout', () => {
  it('returns result when work finishes before timeout', async () => {
    const out = await hubBrowsePrefetchWithTimeout(Promise.resolve({ ok: true }), 200)
    expect(out).toEqual({ ok: true })
  })

  it('returns null when work exceeds timeout', async () => {
    vi.useFakeTimers()
    const slow = new Promise<string>((resolve) => {
      setTimeout(() => resolve('late'), 10_000)
    })
    const pending = hubBrowsePrefetchWithTimeout(slow, 50)
    await vi.advanceTimersByTimeAsync(60)
    await expect(pending).resolves.toBeNull()
    vi.useRealTimers()
  })
})
