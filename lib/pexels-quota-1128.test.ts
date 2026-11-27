/**
 * REGRESSION-FREEZE[pexels-quota-1128]: Pexels 월 한도 소진(remaining 0) 뒤 reset 까지 호출 0, 같은 검색어 24시간 보관, 동시 같은 검색 1번
 */
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PEXELS_QUOTA_STOP_MAX_MS, PexelsCallGuard, sharedPexelsCallGuard, type StockGuardClock } from '@/lib/register-photo-stock-rate-guard'
import { PEXELS_RESULT_CACHE_TTL_MS, pexelsKeywordHasPhotos, pexelsSearch, resetPexelsSearchCacheForTest, searchPexelsHeroCandidates } from '@/lib/pexels-service'

function clockAt(start: number): StockGuardClock & { t: number } {
  const c = { t: start, now: () => c.t, sleep: async (ms: number) => void (c.t += ms) }
  return c
}

const RESET_1221 = 1797825153 // 2026-12-21 12:52:33 KST (박대리 01:46 헤더)
const NOW_1128 = Date.parse('2026-11-27T16:46:22Z')

function res(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
}
const photo = (id: number) => ({ id, width: 4000, height: 2600, src: { original: `https://images.pexels.com/photos/${id}/x.jpeg` }, photographer: 'A', url: `https://www.pexels.com/photo/x-${id}/`, alt: 'Blue Mosque' })

describe('pexels-quota-1128: 한도 헤더 멈춤', () => {
  it('remaining 0 이면 reset 시각까지 멈춘다', () => {
    const c = clockAt(NOW_1128)
    const g = new PexelsCallGuard(c, 0)
    g.onQuotaHeaders(0, RESET_1221)
    expect(g.isStopped()).toBe(true)
    expect(g.stoppedUntilMs()).toBe(RESET_1221 * 1000)
    c.t = RESET_1221 * 1000 - 1
    expect(g.isStopped()).toBe(true)
    c.t = RESET_1221 * 1000 + 1
    expect(g.isStopped()).toBe(false)
  })
  it('남은 한도가 있으면 멈추지 않고, reset 이 없거나 지나간 값이면 1시간, 지나치게 먼 값은 35일로 자른다', () => {
    const c = clockAt(NOW_1128)
    const g = new PexelsCallGuard(c, 0)
    g.onQuotaHeaders(24999, RESET_1221)
    expect(g.isStopped()).toBe(false)
    g.onQuotaHeaders(0, null)
    expect(g.stoppedUntilMs()).toBe(NOW_1128 + 60 * 60 * 1000)
    const g2 = new PexelsCallGuard(c, 0)
    g2.onQuotaHeaders(0, NOW_1128 / 1000 + 400 * 24 * 3600)
    expect(g2.stoppedUntilMs()).toBe(NOW_1128 + PEXELS_QUOTA_STOP_MAX_MS)
  })
  it('429 는 기존처럼 1시간 멈춤, 더 긴 한도 멈춤을 줄이지 않는다', () => {
    const c = clockAt(NOW_1128)
    const g = new PexelsCallGuard(c, 0)
    g.onQuotaHeaders(0, RESET_1221)
    g.onStatus(429)
    expect(g.stoppedUntilMs()).toBe(RESET_1221 * 1000)
  })
})

describe('pexels-quota-1128: 단일 검색 관문', () => {
  beforeEach(() => resetPexelsSearchCacheForTest())
  afterEach(() => vi.restoreAllMocks())

  it('키가 없으면 호출하지 않는다', async () => {
    const f = vi.fn()
    expect(await pexelsSearch({ query: 'blue mosque', per_page: 5 }, { apiKey: '', fetchImpl: f as never, guard: new PexelsCallGuard(clockAt(0), 0) })).toBeNull()
    expect(f).not.toHaveBeenCalled()
  })

  it('remaining 0 응답 뒤에는 다른 검색어도 호출하지 않고 멈춤을 돌려준다(다음 출처로)', async () => {
    const c = clockAt(NOW_1128)
    const guard = new PexelsCallGuard(c, 0)
    const f = vi.fn(async () => res(429, { error: 'limit' }, { 'x-ratelimit-limit': '25000', 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(RESET_1221) }))
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const a = await pexelsSearch({ query: 'blue mosque', per_page: 5 }, { apiKey: 'k', fetchImpl: f as never, guard, now: c.now })
    expect(a).toEqual({ error: 'HTTP 429' })
    const b = await pexelsSearch({ query: 'hagia sophia', per_page: 5 }, { apiKey: 'k', fetchImpl: f as never, guard, now: c.now })
    expect(b).toEqual({ error: 'pexels_stopped' })
    c.t += 23 * 24 * 3600 * 1000 // 12/20
    expect(await pexelsSearch({ query: 'galata tower', per_page: 5 }, { apiKey: 'k', fetchImpl: f as never, guard, now: c.now })).toEqual({ error: 'pexels_stopped' })
    expect(f).toHaveBeenCalledTimes(1)
    const line = log.mock.calls.map((x) => String(x[0])).find((x) => x.includes('pexels-call'))!
    expect(line).toContain('"status":429')
    expect(line).toContain('"remaining":0')
    expect(line).not.toContain('"k"')
  })

  it('같은 검색어는 24시간 보관 결과를 쓰고, 지나면 다시 부른다', async () => {
    const c = clockAt(NOW_1128)
    const guard = new PexelsCallGuard(c, 0)
    const f = vi.fn(async () => res(200, { photos: [photo(1)] }, { 'x-ratelimit-remaining': '100' }))
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const d = { apiKey: 'k', fetchImpl: f as never, guard, now: c.now }
    await pexelsSearch({ query: 'Blue Mosque', per_page: 5 }, d)
    const again = await pexelsSearch({ query: 'blue mosque ', per_page: 5 }, d)
    expect(again).toMatchObject({ cached: true })
    expect(f).toHaveBeenCalledTimes(1)
    c.t += PEXELS_RESULT_CACHE_TTL_MS + 1
    await pexelsSearch({ query: 'Blue Mosque', per_page: 5 }, d)
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('동시에 같은 검색어를 여러 번 불러도(갤러리 Promise.all) 실제 호출은 1번', async () => {
    const guard = new PexelsCallGuard(clockAt(NOW_1128), 0)
    const f = vi.fn(async () => res(200, { photos: [photo(2)] }))
    vi.spyOn(console, 'log').mockImplementation(() => {})
    await Promise.all([1, 2, 3, 4].map(() => pexelsSearch({ query: 'tropical beach travel', per_page: 1 }, { apiKey: 'k', fetchImpl: f as never, guard })))
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('멈춤 중 키워드 확인은 키워드를 지우지 않는다(true), 히어로 검색은 빈 결과로 다음 출처', async () => {
    const prev = process.env.PEXELS_API_KEY
    process.env.PEXELS_API_KEY = 'test-key'
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    try {
      sharedPexelsCallGuard().onQuotaHeaders(0, Math.floor(Date.now() / 1000) + 3600 * 24)
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect(await pexelsKeywordHasPhotos('Blue Mosque Istanbul')).toBe(true)
      expect(await searchPexelsHeroCandidates('Blue Mosque Istanbul', 5, 'q')).toEqual([])
      expect(f).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
      if (prev === undefined) delete process.env.PEXELS_API_KEY
      else process.env.PEXELS_API_KEY = prev
    }
  })
})

describe('pexels-quota-1128: 정적 가드', () => {
  it('pexels-service 의 모든 검색은 단일 관문(pexelsSearch)만 쓴다', () => {
    const src = readFileSync('lib/pexels-service.ts', 'utf8')
    expect(src).not.toContain('client.photos.search')
    expect(src).not.toContain("from 'pexels'")
    expect((src.match(/api\.pexels\.com/g) ?? []).length).toBe(1)
  })
})
