/**
 * REGRESSION-FREEZE[free-src-1128]: 사장님 11/28 08:08 'pexels 못쓰니 unsplash·pixabay·openverse 등 출처 안넣어도 되는 사진으로 준비해봐라.
 * unsplash는 시간당 1000회 한도', 08:10 '지금 봉투어도 사진 못가져오고있잖아'.
 * Pexels 멈춤 동안 풀 → Unsplash → Pixabay → Openverse/Wikimedia CC0·PD, 표기 의무 없는 라이선스만, 각 출처 한도 가드.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { acquireVerifiedPhoto, type AcquireDeps, type AcquireInput } from '@/lib/photo-autofill-acquire'
import { buildPublicPhotoUsage, type AutofillCandidate } from '@/lib/photo-autofill-gate'
import { PixabayCallGuard, UNSPLASH_PROD_MAX_CALLS_PER_HOUR, UnsplashCallBudget, sharedUnsplashCallBudget } from '@/lib/register-photo-stock-rate-guard'
import { __resetPixabayCacheForTest, isPixabayStopped, pixabayHitsToCandidates, searchPixabayCandidates } from '@/lib/pixabay-service'
import { __resetUnsplashCacheForTest, searchUnsplashHeroCandidates } from '@/lib/unsplash-service'
import { __resetOpenverseForTest, isOpenverseStopped, openverseRowsToCandidates, searchOpenverseCc0 } from '@/lib/photo-autofill-openverse'
import { evaluateImageCandidatePolicy, resolveImageSourceTier } from '@/lib/product-image-source-policy'
import { poolRowOriginSource } from '@/lib/photo-autofill-live-deps'

const fakeClock = () => {
  const c = { t: 1_000_000, now: () => c.t, sleep: async () => {} }
  return c
}
const res = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

beforeEach(() => {
  __resetPixabayCacheForTest()
  __resetUnsplashCacheForTest()
  __resetOpenverseForTest()
})
afterEach(() => vi.restoreAllMocks())

function cand(id: string, source: string, over: Partial<AutofillCandidate> = {}): AutofillCandidate {
  return {
    id,
    source,
    url: `https://example.org/${id}.jpg`,
    width: 2000,
    height: 1300,
    photographer: 'Jane',
    originalLink: `https://example.org/page/blue-mosque-${id}`,
    altText: 'Blue Mosque in Istanbul',
    tags: [],
    ...over,
  }
}

function deps(opts: { pexelsStopped: boolean; results: (tier: string) => AutofillCandidate[]; cc0?: () => AutofillCandidate[]; off?: (t: string) => string | null }) {
  const order: string[] = []
  const d: AcquireDeps = {
    stockStopped: (t) => (t === 'pexels' ? opts.pexelsStopped : false),
    stockOffReason: opts.off,
    pause: async () => {},
    search: async (tier) => {
      order.push(tier)
      return opts.results(tier)
    },
    searchCc0: async () => {
      order.push('cc0')
      return opts.cc0?.() ?? []
    },
    commit: async (c) => ({ ok: true, url: c.url, bytes: 150_000, width: c.width, source: c.source, photographer: String(c.photographer), originalLink: String(c.originalLink), externalId: c.id }),
    isMonochrome: async () => false,
  }
  return { d, order }
}
const input = (): AcquireInput => ({
  productId: 'p1',
  kind: 'day',
  day: 1,
  sights: ['Blue Mosque'],
  cityTerms: ['Istanbul'],
  destinationText: 'Istanbul Turkey',
  usage: buildPublicPhotoUsage([]),
  origin: 'autofill',
})

describe('free-src-1128 source order', () => {
  it('Pexels 멈춤: Pexels 호출 0, Unsplash → Pixabay → CC0 순서', async () => {
    const { d, order } = deps({ pexelsStopped: true, results: () => [] })
    const r = await acquireVerifiedPhoto(input(), d)
    expect(r.ok).toBe(false)
    expect(order).not.toContain('pexels')
    const firstIdx = (t: string) => order.indexOf(t)
    expect(firstIdx('unsplash')).toBeGreaterThanOrEqual(0)
    expect(firstIdx('unsplash')).toBeLessThan(firstIdx('pixabay'))
    expect(firstIdx('pixabay')).toBeLessThan(firstIdx('cc0'))
    if (!r.ok) expect(r.exception.detail).toContain('pexels_limit')
  })
  it('Pexels 멈춤 중 Unsplash 사진을 실제로 채택한다', async () => {
    const { d } = deps({ pexelsStopped: true, results: (t) => (t === 'unsplash' ? [cand('u1', 'Unsplash')] : []) })
    const r = await acquireVerifiedPhoto(input(), d)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.photo.source).toBe('Unsplash')
  })
  it('Unsplash 가 비면 Pixabay 를 채택한다', async () => {
    const { d } = deps({ pexelsStopped: true, results: (t) => (t === 'pixabay' ? [cand('pb-1', 'Pixabay')] : []) })
    const r = await acquireVerifiedPhoto(input(), d)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.photo.source).toBe('Pixabay')
  })
  it('Pixabay 키 없음은 호출 없이 pixabay_no_key 로 남기고 CC0 로 간다', async () => {
    const { d, order } = deps({
      pexelsStopped: true,
      results: () => [],
      cc0: () => [cand('ov-1', 'CC0')],
      off: (t) => (t === 'pixabay' ? 'pixabay_no_key' : null),
    })
    const r = await acquireVerifiedPhoto(input(), d)
    expect(order).not.toContain('pixabay')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.photo.source).toBe('CC0')
  })
  it('Pexels 살아 있으면 R03-06 순서(Pexels → CC0 → Unsplash → Pixabay)', async () => {
    const { d, order } = deps({ pexelsStopped: false, results: () => [] })
    await acquireVerifiedPhoto(input(), d)
    expect(order.indexOf('pexels')).toBeLessThan(order.indexOf('cc0'))
    expect(order.indexOf('cc0')).toBeLessThan(order.indexOf('unsplash'))
    expect(order.indexOf('unsplash')).toBeLessThan(order.indexOf('pixabay'))
  })
})

describe('free-src-1128 licenses (출처 표기 의무 없는 사진만)', () => {
  it('Openverse 는 cc0·pdm 만, CC BY 계열은 버린다', () => {
    const rows = openverseRowsToCandidates({
      results: ['cc0', 'pdm', 'by', 'by-sa', 'by-nc'].map((license, i) => ({ id: String(i), url: `https://x.org/${i}.jpg`, width: 2000, height: 1200, license })),
    })
    expect(rows.map((r) => r.description)).toEqual(['CC0', 'Public Domain Mark'])
  })
  it('Pixabay 는 사진(photo)만, 일러스트·벡터 제외, 출처 Pixabay·라이선스 표기 의무 없음', () => {
    const rows = pixabayHitsToCandidates({
      hits: [
        { id: 1, type: 'photo', pageURL: 'https://pixabay.com/photos/blue-mosque-istanbul-1/', tags: 'blue mosque, istanbul', largeImageURL: 'https://pixabay.com/get/a_1280.jpg', imageWidth: 4000, imageHeight: 2500, user: 'u' },
        { id: 2, type: 'illustration', pageURL: 'https://pixabay.com/illustrations/x-2/', largeImageURL: 'https://pixabay.com/get/b_1280.jpg', imageWidth: 4000, imageHeight: 2500 },
        { id: 3, type: 'vector/svg', pageURL: 'https://pixabay.com/vectors/x-3/', largeImageURL: 'https://pixabay.com/get/c_1280.jpg', imageWidth: 4000, imageHeight: 2500 },
      ],
    })
    expect(rows.map((r) => r.id)).toEqual(['pb-1'])
    expect(rows[0]).toMatchObject({ source: 'Pixabay', width: 1280, height: 800 })
    expect(rows[0]!.altText).toContain('blue mosque istanbul')
    const pol = evaluateImageCandidatePolicy({ url: 'https://kr.object.ncloudstorage.com/bongtour/photo-pool/x.webp', source: 'Pixabay', originalLink: rows[0]!.originalLink, width: 1280 } as never)
    expect(resolveImageSourceTier({ source: 'Pixabay', originalLink: rows[0]!.originalLink } as never)).toBe('pixabay')
    expect(pol.fails).not.toContain('L2-OTHER-SOURCE')
    expect(pol.creditRequired).toBe(false)
    expect(poolRowOriginSource('Pixabay', rows[0]!.originalLink)).toBe('Pixabay')
  })
})

describe('free-src-1128 guards', () => {
  it('공용 Unsplash 예산은 시간당 900(<1000)', () => {
    expect(UNSPLASH_PROD_MAX_CALLS_PER_HOUR).toBe(900)
    expect(UNSPLASH_PROD_MAX_CALLS_PER_HOUR).toBeLessThan(1000)
    expect(sharedUnsplashCallBudget().remaining()).toBeLessThanOrEqual(900)
  })
  it('Unsplash 응답 헤더 remaining 0 이면 1시간 멈춤, 같은 검색은 24시간 보관(호출 1번)', async () => {
    const clock = fakeClock()
    const budget = new UnsplashCallBudget(clock, 900)
    const env = { UNSPLASH_ACCESS_KEY: 'test-only' }
    const fetchImpl = vi.fn(async () => res({ results: [] }, 200, { 'x-ratelimit-remaining': '5' })) as unknown as typeof fetch
    await searchUnsplashHeroCandidates('Blue Mosque', 10, 'Blue Mosque', { env, fetchImpl, budget, cache: true, now: clock.now })
    await searchUnsplashHeroCandidates('Blue Mosque', 10, 'Blue Mosque', { env, fetchImpl, budget, cache: true, now: clock.now })
    expect((fetchImpl as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(1)
    const zero = vi.fn(async () => res({ results: [] }, 200, { 'x-ratelimit-remaining': '0' })) as unknown as typeof fetch
    await searchUnsplashHeroCandidates('Hagia Sophia', 10, 'Hagia Sophia', { env, fetchImpl: zero, budget, cache: true, now: clock.now })
    expect(budget.isStopped()).toBe(true)
    await searchUnsplashHeroCandidates('Galata Tower', 10, 'Galata Tower', { env, fetchImpl: zero, budget, cache: true, now: clock.now })
    expect((zero as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(1)
    clock.t += 60 * 60 * 1000 + 1
    expect(budget.isStopped()).toBe(false)
  })
  it('Pixabay: 키 없으면 네트워크 0 + no_key 로그 1줄, 60초 60번, 헤더 0 이면 reset 까지 정지, 24시간 보관', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const none = vi.fn() as unknown as typeof fetch
    expect(await searchPixabayCandidates('Blue Mosque', 20, { env: {}, fetchImpl: none })).toEqual([])
    expect(await searchPixabayCandidates('Blue Mosque', 20, { env: {}, fetchImpl: none })).toEqual([])
    expect(none).not.toHaveBeenCalled()
    expect(log.mock.calls.map((c) => String(c[0])).filter((l) => l.includes('"skipped":"no_key"'))).toHaveLength(1)
    expect(isPixabayStopped({})).toBe('pixabay_no_key')

    const clock = fakeClock()
    const guard = new PixabayCallGuard(clock)
    const env = { PIXABAY_API_KEY: 'test-only' }
    const ok = vi.fn(async () => res({ hits: [] }, 200, { 'x-ratelimit-remaining': '50', 'x-ratelimit-reset': '30' })) as unknown as typeof fetch
    await searchPixabayCandidates('Blue Mosque', 20, { env, fetchImpl: ok, guard, now: clock.now })
    await searchPixabayCandidates('Blue Mosque', 20, { env, fetchImpl: ok, guard, now: clock.now })
    expect((ok as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(1)
    const url = String((ok as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]![0])
    expect(url).toContain('image_type=photo')
    expect(log.mock.calls.map((c) => String(c[0])).join('\n')).not.toContain('test-only')

    for (let i = 0; i < 70; i++) await searchPixabayCandidates(`q${i}`, 20, { env, fetchImpl: ok, guard, now: clock.now })
    expect((ok as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(60)

    const g2 = new PixabayCallGuard(clock)
    const zero = vi.fn(async () => res({ hits: [] }, 200, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '40' })) as unknown as typeof fetch
    await searchPixabayCandidates('Hagia Sophia', 20, { env, fetchImpl: zero, guard: g2, now: clock.now })
    expect(g2.isStopped()).toBe(true)
    clock.t += 41_000
    expect(g2.isStopped()).toBe(false)
  })
  it('Openverse 익명: 헤더 available 0 이면 멈춤([] 반환, 호출 없음), 토큰 env 가 있으면 Bearer', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const zero = vi.fn(async () =>
      res({ results: [] }, 200, { 'x-ratelimit-available-anon_burst': '0', 'x-ratelimit-available-anon_sustained': '500' }),
    ) as unknown as typeof fetch
    await searchOpenverseCc0('Blue Mosque', 10, zero, { env: {} })
    expect(isOpenverseStopped()).toBe(true)
    expect(await searchOpenverseCc0('Hagia Sophia', 10, zero, { env: {} })).toEqual([])
    expect((zero as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(1)

    __resetOpenverseForTest()
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const withTok = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      if (url.includes('auth_tokens/token')) return res({ access_token: 'tok-test', expires_in: 3600 })
      return res({ results: [] })
    }) as unknown as typeof fetch
    await searchOpenverseCc0('Blue Mosque', 10, withTok, { env: { OPENVERSE_CLIENT_ID: 'id', OPENVERSE_CLIENT_SECRET: 'sec' } })
    const search = calls.find((c) => c.url.includes('/v1/images/'))!
    expect((search.init?.headers as Record<string, string>).Authorization).toBe('Bearer tok-test')
  })
})
