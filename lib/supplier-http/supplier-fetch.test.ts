import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  classifySupplierFetchThrown,
  parseRetryAfterMs,
  supplierFetch,
  type SupplierFetchOptions,
  type SupplierFetchRetryPolicy,
} from '@/lib/supplier-http/supplier-fetch'

const RETRY: SupplierFetchRetryPolicy = { maxRetries: 1, baseDelayMs: 5_000, jitterMs: 3_000, maxRetryAfterMs: 30_000 }

function timeoutError(): Error {
  const e = new Error('The operation was aborted due to timeout')
  e.name = 'TimeoutError'
  return e
}

function connReset(): Error {
  return Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } })
}

function opts(fetchImpl: typeof fetch, extra?: Partial<SupplierFetchOptions>): SupplierFetchOptions {
  return {
    supplier: 'naeiltour',
    part: 'tab0',
    url: 'https://www.naeiltour.co.kr/sub/view_process.asp?x=secret',
    timeoutMs: 30_000,
    idempotent: true,
    retry: RETRY,
    fetchImpl,
    random: () => 0.5,
    ...extra,
  }
}

/** 가짜 타이머를 1초씩 밀면서 promise가 끝날 때까지 기다린다. 경과 ms 반환. */
async function settleWithFakeTimers<T>(p: Promise<T>): Promise<{ value: T; advancedMs: number }> {
  let done = false
  let value!: T
  let error: unknown
  p.then(
    (v) => {
      done = true
      value = v
    },
    (e) => {
      done = true
      error = e
    },
  )
  let advancedMs = 0
  for (let i = 0; i < 200 && !done; i++) {
    await vi.advanceTimersByTimeAsync(1_000)
    if (!done) advancedMs += 1_000
  }
  if (error) throw error
  return { value, advancedMs }
}

describe('supplierFetch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('timeout → waits several seconds → retries once → structured failure (SKIP reason fields)', async () => {
    const fetchImpl = vi.fn(async () => {
      throw timeoutError()
    }) as unknown as typeof fetch
    const { value: r, advancedMs } = await settleWithFakeTimers(supplierFetch(opts(fetchImpl)))
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errorKind).toBe('timeout')
    expect(r.attempts).toHaveLength(2)
    expect(r.attempts.map((a) => a.errorKind)).toEqual(['timeout', 'timeout'])
    expect(r.url).toBe('https://www.naeiltour.co.kr/sub/view_process.asp')
    expect(r.supplier).toBe('naeiltour')
    expect(r.part).toBe('tab0')
    expect(advancedMs).toBeGreaterThanOrEqual(5_000)
    expect(r.elapsedMs).toBeGreaterThanOrEqual(5_000)
  })

  it('retry wait is at least base 5s and below base+jitter', async () => {
    const sleeps: number[] = []
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(connReset())
      .mockResolvedValueOnce(new Response('ok', { status: 200 })) as unknown as typeof fetch
    const r = await supplierFetch(
      opts(fetchImpl, {
        random: () => 0.999,
        sleep: async (ms) => {
          sleeps.push(ms)
        },
      }),
    )
    expect(r.ok).toBe(true)
    expect(sleeps).toHaveLength(1)
    expect(sleeps[0]!).toBeGreaterThanOrEqual(5_000)
    expect(sleeps[0]!).toBeLessThan(8_000)
  })

  it('4xx is not retried', async () => {
    const fetchImpl = vi.fn(async () => new Response('nf', { status: 404 })) as unknown as typeof fetch
    const r = await supplierFetch(opts(fetchImpl))
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errorKind).toBe('http_4xx')
      expect(r.status).toBe(404)
    }
  })

  it('5xx retried once then success returns body', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('err', { status: 503 }))
      .mockResolvedValueOnce(new Response('hello', { status: 200 })) as unknown as typeof fetch
    const { value: r } = await settleWithFakeTimers(supplierFetch(opts(fetchImpl)))
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.body.toString('utf8')).toBe('hello')
      expect(r.attempts.map((a) => a.status)).toEqual([503, 200])
    }
  })

  it('429 respects Retry-After when longer than base wait', async () => {
    const sleeps: number[] = []
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('slow', { status: 429, headers: { 'retry-after': '12' } }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 })) as unknown as typeof fetch
    const r = await supplierFetch(opts(fetchImpl, { sleep: async (ms) => void sleeps.push(ms) }))
    expect(r.ok).toBe(true)
    expect(sleeps).toEqual([12_000])
  })

  it('429 with Retry-After beyond cap is not retried', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('slow', { status: 429, headers: { 'retry-after': '120' } }),
    ) as unknown as typeof fetch
    const r = await supplierFetch(opts(fetchImpl, { sleep: async () => {} }))
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errorKind).toBe('http_429')
  })

  it('non-idempotent requests never retry', async () => {
    const fetchImpl = vi.fn(async () => {
      throw connReset()
    }) as unknown as typeof fetch
    const r = await supplierFetch(opts(fetchImpl, { idempotent: false }))
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errorKind).toBe('conn_reset')
  })

  it('classifies thrown errors and Retry-After', () => {
    expect(classifySupplierFetchThrown(timeoutError())).toBe('timeout')
    expect(classifySupplierFetchThrown(connReset())).toBe('conn_reset')
    expect(
      classifySupplierFetchThrown(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } })),
    ).toBe('conn_fail')
    expect(
      classifySupplierFetchThrown(Object.assign(new TypeError('fetch failed'), { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } })),
    ).toBe('timeout')
    expect(parseRetryAfterMs('3', 0)).toBe(3_000)
    expect(parseRetryAfterMs('', 0)).toBeNull()
  })
})
