/**
 * REGRESSION-FREEZE[pexels-stop-persist-1128]: Pexels 실제 한도(429·남은 한도 0) → stoppedUntil 영구 저장 →
 * 재시작(새 프로세스)에서도 Pexels 를 건너뛰고 Pixabay 로 교체 완료 → 만료 뒤 Pexels 복귀. 가짜 시계(Date)만 쓴다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// 기존 ScraperSupplierState 행(키-값)만 흉내 낸 메모리 저장소 — 새 표·칸 없음
const rows = new Map<string, { supplierKey: string; lastStartedAt: Date | null; lastFinishedAt: Date | null }>()
vi.mock('@/lib/prisma', () => ({
  prisma: {
    scraperSupplierState: {
      findUnique: async ({ where }: { where: { supplierKey: string } }) => rows.get(where.supplierKey) ?? null,
      upsert: async ({ where, update, create }: { where: { supplierKey: string }; update: Record<string, Date>; create: Record<string, unknown> }) => {
        const prev = rows.get(where.supplierKey)
        const next = prev ? { ...prev, ...update } : (create as never)
        rows.set(where.supplierKey, next)
        return next
      },
    },
  },
}))

import { acquireVerifiedPhoto, type AcquireDeps, type AcquireInput } from '@/lib/photo-autofill-acquire'
import { buildPublicPhotoUsage, PublicPhotoUsage, type AutofillCandidate } from '@/lib/photo-autofill-gate'
import { healBlockedSlots, type HealDeps } from '@/lib/photo-heal'
import type { PhotoException } from '@/lib/photo-exception-list'
import { pexelsSearch } from '@/lib/pexels-service'
import {
  hydrateSharedPexelsStop,
  PexelsCallGuard,
  sharedPexelsCallGuard,
  STOCK_STOP_AFTER_LIMIT_MS,
} from '@/lib/register-photo-stock-rate-guard'
import { __resetStopHydrationForTest, hydrateStopFromStore, PEXELS_STOP_STATE_KEY, persistStop, type StockStopStore } from '@/lib/stock-stop-persist'
import type { RegistrationPhotoBlock } from '@/lib/register-photo-registration-gate'

const T0 = Date.parse('2026-11-28T10:00:00+09:00')
const HOUR = 60 * 60 * 1000

/** 프로세스 재시작 흉내: 메모리 가드·복원 표시를 모두 지운다(모듈 상태는 globalThis 에 있다) */
function restartProcess() {
  const g = globalThis as unknown as Record<string, unknown>
  delete g.__btPexelsGuard
  __resetStopHydrationForTest()
}

const resp = (status: number, body: unknown = {}, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

beforeEach(() => {
  rows.clear()
  restartProcess()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(T0)
})
afterEach(() => vi.useRealTimers())

function cand(id: string, source: string): AutofillCandidate {
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
  }
}

/** 실제 acquireVerifiedPhoto + 가짜 검색(출처별 호출 기록). Pexels 멈춤 여부는 공용 가드가 정한다. */
function liveLikeDeps() {
  const order: string[] = []
  let k = 0 // 칸마다 다른 사진(같은 상품 안 중복 금지 R03-12)
  const d: AcquireDeps = {
    stockStopped: (t) => (t === 'pexels' ? sharedPexelsCallGuard().isStopped() : false),
    pause: async () => {},
    search: async (tier) => {
      order.push(tier)
      return tier === 'pixabay' || tier === 'pexels' ? [cand(`${tier}-${++k}`, tier === 'pexels' ? 'Pexels' : 'Pixabay')] : []
    },
    searchCc0: async () => (order.push('cc0'), []),
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

describe('pexels-stop-persist-1128: 저장·복원', () => {
  it('Pexels 429 → stoppedUntil 이 기존 ScraperSupplierState 행에 저장된다(스키마·env 변경 없음)', async () => {
    const fetchImpl = vi.fn(async () => resp(429)) as unknown as typeof fetch
    const r = await pexelsSearch({ query: 'blue mosque', per_page: 15 }, { apiKey: 'k', fetchImpl, now: () => Date.now() })
    expect(r).toEqual({ error: 'HTTP 429' })
    await vi.waitFor(() => expect(rows.get(PEXELS_STOP_STATE_KEY)).toBeDefined())
    const row = rows.get(PEXELS_STOP_STATE_KEY)!
    expect(row.lastFinishedAt!.getTime()).toBe(T0 + STOCK_STOP_AFTER_LIMIT_MS)
    expect(row.lastStartedAt!.getTime()).toBe(T0)
    expect([...rows.keys()]).toEqual([PEXELS_STOP_STATE_KEY])
  })

  it('남은 한도 0 응답(헤더)도 reset 시각까지 저장된다', async () => {
    const resetSec = Math.floor((T0 + 3 * 24 * HOUR) / 1000)
    const fetchImpl = vi.fn(async () => resp(200, { photos: [] }, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(resetSec) })) as unknown as typeof fetch
    await pexelsSearch({ query: 'hagia sophia', per_page: 15 }, { apiKey: 'k', fetchImpl, now: () => Date.now() })
    await vi.waitFor(() => expect(rows.get(PEXELS_STOP_STATE_KEY)).toBeDefined())
    expect(rows.get(PEXELS_STOP_STATE_KEY)!.lastFinishedAt!.getTime()).toBe(resetSec * 1000)
  })

  it('저장된 값보다 이른 멈춤으로는 덮어쓰지 않는다(늘리기만)', async () => {
    const mem = new Map<string, number>()
    const store: StockStopStore = { load: async () => mem.get('k') ?? null, save: async (u) => void mem.set('k', Math.max(u, mem.get('k') ?? 0)) }
    await persistStop(store, T0 + 5 * HOUR, T0)
    await persistStop(store, T0 + HOUR, T0)
    expect(await store.load()).toBe(T0 + 5 * HOUR)
  })

  it('새 프로세스: 429 로 저장 → 재시작 → 저장값을 복원해 Pexels 를 부르지 않고 Pixabay 로 채택한다(R03-26)', async () => {
    const fetch1 = vi.fn(async () => resp(429)) as unknown as typeof fetch
    await pexelsSearch({ query: 'blue mosque', per_page: 15 }, { apiKey: 'k', fetchImpl: fetch1, now: () => Date.now() })
    await vi.waitFor(() => expect(rows.get(PEXELS_STOP_STATE_KEY)).toBeDefined())

    vi.setSystemTime(T0 + 10 * 60 * 1000) // 10분 뒤 재배포·재시작
    restartProcess()
    expect(sharedPexelsCallGuard().isStopped()).toBe(false) // 메모리는 비어 있다
    await hydrateSharedPexelsStop()
    expect(sharedPexelsCallGuard().isStopped()).toBe(true)
    expect(sharedPexelsCallGuard().stoppedUntilMs()).toBe(T0 + STOCK_STOP_AFTER_LIMIT_MS)

    // 재시작 뒤 첫 Pexels 검색은 네트워크를 타지 않고 멈춤으로 돌려보낸다
    const fetch2 = vi.fn(async () => resp(200, { photos: [] })) as unknown as typeof fetch
    expect(await pexelsSearch({ query: 'blue mosque', per_page: 15 }, { apiKey: 'k', fetchImpl: fetch2, now: () => Date.now() })).toEqual({ error: 'pexels_stopped' })
    expect(fetch2).not.toHaveBeenCalled()

    const { d, order } = liveLikeDeps()
    const r = await acquireVerifiedPhoto(input(), d)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.photo.source).toBe('Pixabay')
    expect(order).not.toContain('pexels')
    expect(order).not.toContain('unsplash')
    expect(order[0]).toBe('pixabay')
  })

  it('만료 뒤 Pexels 복귀: 저장된 시각이 지나면 다시 Pexels 부터 부른다', async () => {
    await persistStop(
      { load: async () => null, save: async (u, r) => void rows.set(PEXELS_STOP_STATE_KEY, { supplierKey: PEXELS_STOP_STATE_KEY, lastStartedAt: new Date(r), lastFinishedAt: new Date(u) }) },
      T0 + HOUR,
      T0,
    )
    vi.setSystemTime(T0 + HOUR + 1000)
    restartProcess()
    await hydrateSharedPexelsStop()
    expect(sharedPexelsCallGuard().isStopped()).toBe(false)
    const { d, order } = liveLikeDeps()
    const r = await acquireVerifiedPhoto(input(), d)
    expect(r.ok).toBe(true)
    expect(order[0]).toBe('pexels')
  })

  it('저장소 읽기 실패는 막지 않는다(메모리 기준으로 계속)', async () => {
    const g = new PexelsCallGuard({ now: () => T0, sleep: async () => {} })
    const got = await hydrateStopFromStore(g, { load: async () => Promise.reject(new Error('db down')), save: async () => {} }, { now: () => T0, force: true })
    expect(got).toBeNull()
    expect(g.isStopped()).toBe(false)
  })
})

describe('pexels-stop-persist-1128: 자가힐이 멈추지 않는다', () => {
  const aiBlock = (day: number): RegistrationPhotoBlock => ({ kind: 'day', day, reason: 'photo_ai_generated', detail: 'Gemini' })
  const schedule = JSON.stringify(
    [1, 2, 3].map((day) => ({
      day,
      title: `${day}일차`,
      routeText: '이스탄불 - 블루모스크',
      imageUrl: `https://cdn.example.com/old${day}.webp`,
      imageSource: { source: 'Gemini', originalLink: '', externalId: '' },
      imageIsGenerated: true,
    })),
  )

  it('Pexels 저장된 멈춤(재시작 뒤) 상태에서 틀린 칸 3개가 같은 실행에서 Pixabay 로 모두 교체되고 비운 칸은 0(R03-26)', async () => {
    rows.set(PEXELS_STOP_STATE_KEY, { supplierKey: PEXELS_STOP_STATE_KEY, lastStartedAt: new Date(T0), lastFinishedAt: new Date(T0 + HOUR) })
    vi.setSystemTime(T0 + 5 * 60 * 1000)
    restartProcess()
    await hydrateSharedPexelsStop()

    const { d, order } = liveLikeDeps()
    let n = 0
    const exceptions: PhotoException[] = []
    const writes: string[] = []
    const deps: HealDeps = {
      acquire: (i) => acquireVerifiedPhoto({ ...i, usage: buildPublicPhotoUsage([]) }, { ...d, search: async (tier, q, per) => (n++, d.search(tier, `${q}-${n}`, per)) }),
      writeSchedule: async (_p, _e, next) => (writes.push(next), true),
      writeCover: async () => true,
      recordException: async (e) => void exceptions.push(e),
      recordReplace: async () => {},
      usage: new PublicPhotoUsage(),
      maxSlotsPerProduct: Number.POSITIVE_INFINITY,
      allowClear: false,
    }
    const res = await healBlockedSlots(
      { productId: 'p1', destinationTerms: ['이스탄불', 'istanbul'], cityTerms: ['istanbul'], schedule, cover: null, blocks: [aiBlock(1), aiBlock(2), aiBlock(3)] },
      deps,
    )
    expect(order).not.toContain('pexels')
    expect(order).not.toContain('unsplash')
    expect(res.replaced).toHaveLength(3)
    const finalRows = JSON.parse(res.schedule!) as Array<{ imageUrl: string; imageSource: { source: string } }>
    expect(finalRows.every((r) => r.imageUrl.trim() !== '' && r.imageSource.source === 'Pixabay')).toBe(true)
  })

  it('저장된 stoppedUntil 이 2026-12-21(사장님 20:29 해제 전제)이면 Pexels 네트워크 호출 0이고 Pixabay 로 이어진다', async () => {
    const until = new Date('2026-12-21T00:00:00+09:00')
    rows.set(PEXELS_STOP_STATE_KEY, { supplierKey: PEXELS_STOP_STATE_KEY, lastStartedAt: new Date(T0), lastFinishedAt: until })
    vi.setSystemTime(new Date('2026-11-28T20:30:00+09:00'))
    restartProcess()
    await hydrateSharedPexelsStop()
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ photos: [] }), { status: 200 })) as unknown as typeof fetch
    const { pexelsSearch } = await import('@/lib/pexels-service')
    expect(await pexelsSearch({ query: 'blue mosque', per_page: 15 }, { apiKey: 'k', fetchImpl, now: () => Date.now() })).toEqual({ error: 'pexels_stopped' })
    expect(fetchImpl).not.toHaveBeenCalled()
    const { d, order } = liveLikeDeps()
    const r = await acquireVerifiedPhoto(input(), d)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.photo.source).toBe('Pixabay')
    expect(order).not.toContain('pexels')
    expect(order).not.toContain('unsplash')
    expect(order[0]).toBe('pixabay')
  })
})
