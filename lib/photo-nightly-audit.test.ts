import { describe, expect, it } from 'vitest'
import type { AcquireInput, AcquireResult } from '@/lib/photo-autofill-acquire'
import type { PhotoException } from '@/lib/photo-exception-list'
import {
  checkPhotoUrl,
  isNightlyAuditWindowKst,
  NIGHTLY_MAX_PRODUCTS_PER_RUN,
  NIGHTLY_MAX_REPLACEMENTS_PER_RUN,
  nightlyProductWindow,
  planDuplicateIssues,
  runPublicPhotoNightlyAudit,
  type NightlyDeps,
  type PublicProductPhotos,
} from '@/lib/photo-nightly-audit'
import { parseReplaceNote } from '@/lib/photo-slot-apply'

function product(id: string, createdAt: string, photos: Array<{ url: string; extId: string; manual?: boolean }>, cover?: { url: string; extId: string }): PublicProductPhotos {
  return {
    id,
    createdAt,
    destination: '이스탄불',
    primaryDestination: null,
    bgImageUrl: cover?.url ?? null,
    bgImageExternalId: cover?.extId ?? null,
    bgImageSourceUrl: null,
    bgImageSource: 'Pexels',
    bgImageRehostSearchLabel: 'Blue Mosque',
    schedule: JSON.stringify(
      photos.map((p, i) => ({
        day: i + 1,
        title: `${id} ${i + 1}일차 제목`,
        description: '설명 그대로',
        routeText: '이스탄불 - 블루모스크 - 그랜드바자르',
        price: 'DO-NOT-TOUCH',
        imageUrl: p.url,
        imageSource: { source: 'Pexels', photographer: 'A', originalLink: '', externalId: p.extId },
        ...(p.manual ? { imageManualSelected: true } : {}),
      })),
    ),
  }
}

function okAcquire(tag: string) {
  let n = 0
  return async (input: AcquireInput): Promise<AcquireResult> => ({
    ok: true,
    tried: [],
    photo: {
      ok: true,
      url: `https://cdn.example.com/${tag}-${++n}.webp`,
      bytes: 100_000,
      width: 1800,
      source: 'Pexels',
      photographer: 'B',
      originalLink: `https://www.pexels.com/photo/blue-mosque-${tag}${n}/`,
      externalId: `${tag}${n}`,
      sight: 'Blue Mosque',
      matched: 'blue mosque',
      query: 'Blue Mosque',
    },
  })
}

function harness(products: PublicProductPhotos[], opts: { status?: (url: string) => number | 'throw'; acquire?: NightlyDeps['acquire'] } = {}) {
  const db = new Map(products.map((p) => [p.id, { ...p }]))
  const exceptions: PhotoException[] = []
  const replaceNotes: Array<{ productId: string; day: number; sourceType: string; notes: string }> = []
  const heads: string[] = []
  let pauses = 0
  let inFlight = 0
  let maxInFlight = 0
  const deps: NightlyDeps = {
    listProducts: async () => [...db.values()].map((p) => ({ ...p })),
    head: async (url) => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      try {
        await Promise.resolve()
        heads.push(url)
        const s = opts.status?.(url) ?? 200
        if (s === 'throw') throw new Error('timeout')
        return { status: s }
      } finally {
        inFlight--
      }
    },
    pause: async () => {
      pauses++
    },
    acquire: opts.acquire ?? okAcquire('n'),
    writeSchedule: async (id, expected, next) => {
      const p = db.get(id)!
      if (p.schedule !== expected) return false
      p.schedule = next
      return true
    },
    writeCover: async (id, expectedUrl, data) => {
      const p = db.get(id)!
      if (p.bgImageUrl !== expectedUrl) return false
      p.bgImageUrl = String(data.bgImageUrl)
      return true
    },
    recordException: async (e) => void exceptions.push(e),
    recordReplace: async (r) => void replaceNotes.push(r),
    now: () => new Date('2026-11-14T13:30:00Z'),
  }
  return { deps, db, exceptions, replaceNotes, heads, stats: () => ({ pauses, maxInFlight }) }
}

describe('photo-nightly-audit: 야간 구간·점검 대상', () => {
  it('KST 22시~다음날 6시 전 구간만 야간', () => {
    const kst = (h: number) => new Date(Date.UTC(2026, 10, 14, h - 9, 15))
    expect(isNightlyAuditWindowKst(kst(22))).toBe(true)
    expect(isNightlyAuditWindowKst(kst(23))).toBe(true)
    expect(isNightlyAuditWindowKst(new Date(Date.UTC(2026, 10, 14, 15, 15)))).toBe(true)
    expect(isNightlyAuditWindowKst(kst(5))).toBe(true)
    expect(isNightlyAuditWindowKst(kst(6))).toBe(false)
    expect(isNightlyAuditWindowKst(kst(14))).toBe(false)
  })

  it('한 번에 점검하는 상품 수는 상한이 있고 밤마다 돌아간다', () => {
    const list = Array.from({ length: NIGHTLY_MAX_PRODUCTS_PER_RUN * 2 + 5 }, (_, i) => ({ id: `p${String(i).padStart(4, '0')}` }))
    const a = nightlyProductWindow(list, new Date('2026-11-14T13:00:00Z'))
    const b = nightlyProductWindow(list, new Date('2026-11-15T13:00:00Z'))
    expect(a).toHaveLength(NIGHTLY_MAX_PRODUCTS_PER_RUN)
    expect(a.map((x) => x.id)).not.toEqual(b.map((x) => x.id))
  })
})

describe('photo-nightly-audit: 깨짐 확인(재시도 1회, 외부 장애는 SKIP)', () => {
  const noPause = async () => {}
  it('404 가 재확인에서도 404 면 깨짐', async () => {
    let n = 0
    const r = await checkPhotoUrl('https://x/a.jpg', async () => ({ status: (n++, 404) }), noPause)
    expect(r.outcome).toBe('broken')
    expect(n).toBe(2)
  })
  it('첫 시도만 실패하고 재확인에서 200 이면 정상', async () => {
    const seq = [404, 200]
    const r = await checkPhotoUrl('https://x/a.jpg', async () => ({ status: seq.shift()! }), noPause)
    expect(r.outcome).toBe('ok')
  })
  it('5xx·429·시간초과는 깨짐이 아니라 SKIP+사유, 읽기는 최대 2번', async () => {
    for (const status of [503, 429]) {
      let n = 0
      const r = await checkPhotoUrl('https://x/a.jpg', async () => ({ status: (n++, status) }), noPause)
      expect(r.outcome, String(status)).toBe('skip')
      expect(n).toBe(2)
    }
    let t = 0
    const r = await checkPhotoUrl('https://x/a.jpg', async () => {
      t++
      throw new Error('abort')
    }, noPause)
    expect(r).toMatchObject({ outcome: 'skip', reason: 'Error' })
    expect(t).toBe(2)
  })
})

describe('photo-nightly-audit: 공개 상품 사이 중복', () => {
  it('먼저 만든 상품이 갖고 나중 상품의 칸만 중복, 같은 상품 안 재사용은 중복 아님', () => {
    const a = product('A', '2026-01-01', [{ url: 'https://cdn.example.com/1.webp', extId: '100' }, { url: 'https://cdn.example.com/1b.webp', extId: '100' }])
    const b = product('B', '2026-02-01', [{ url: 'https://cdn.example.com/2.webp', extId: '100' }, { url: 'https://cdn.example.com/3.webp', extId: '300' }])
    const issues = planDuplicateIssues([b, a])
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ productId: 'B', day: 1, reason: 'public_duplicate' })
  })

  it('대표(카드) 사진이 다른 상품 사진과 같아도 중복', () => {
    const a = product('A', '2026-01-01', [{ url: 'https://cdn.example.com/1.webp', extId: '100' }])
    const b = product('B', '2026-02-01', [], { url: 'https://cdn.example.com/c.webp', extId: '100' })
    expect(planDuplicateIssues([a, b])).toMatchObject([{ productId: 'B', kind: 'cover' }])
  })
})

describe('photo-nightly-audit: 깨진·중복 사진을 같은 게이트 후보로 교체', () => {
  it('깨진 사진은 교체하고, 사진 칸 외 title·설명·동선·가격은 그대로', async () => {
    const p = product('A', '2026-01-01', [
      { url: 'https://cdn.example.com/ok.webp', extId: '1' },
      { url: 'https://cdn.example.com/dead.webp', extId: '2' },
    ])
    const h = harness([p], { status: (u) => (u.includes('dead') ? 404 : 200) })
    const r = await runPublicPhotoNightlyAudit(h.deps)
    expect(r.broken).toBe(1)
    expect(r.replaced).toEqual([{ productId: 'A', kind: 'day', day: 2, reason: 'broken_http' }])
    const before = JSON.parse(p.schedule!)
    const after = JSON.parse(h.db.get('A')!.schedule!)
    expect(after[1].imageUrl).toContain('n-1')
    expect(after[0]).toEqual(before[0])
    for (const k of ['title', 'description', 'routeText', 'price', 'day']) expect(after[1][k]).toEqual(before[1][k])
  })

  it('교체 전 값을 되돌릴 수 있게 기록한다', async () => {
    const p = product('A', '2026-01-01', [{ url: 'https://cdn.example.com/dead.webp', extId: '2' }])
    const h = harness([p], { status: () => 410 })
    await runPublicPhotoNightlyAudit(h.deps)
    expect(h.replaceNotes).toHaveLength(1)
    expect(h.replaceNotes[0]!.sourceType).toBe('nightly-day')
    const note = parseReplaceNote(h.replaceNotes[0]!.notes)
    expect(note).toMatchObject({ reason: 'broken_http', origin: 'nightly', slot: 'day' })
    expect(note!.prev).toMatchObject({ imageUrl: 'https://cdn.example.com/dead.webp' })
  })

  it('중복 사진은 나중 상품 칸만 교체(먼저 만든 상품은 그대로)', async () => {
    const a = product('A', '2026-01-01', [{ url: 'https://cdn.example.com/1.webp', extId: '100' }])
    const b = product('B', '2026-02-01', [{ url: 'https://cdn.example.com/2.webp', extId: '100' }])
    const h = harness([a, b])
    const r = await runPublicPhotoNightlyAudit(h.deps)
    expect(r.duplicates).toBe(1)
    expect(r.replaced).toMatchObject([{ productId: 'B', reason: 'public_duplicate' }])
    expect(h.db.get('A')!.schedule).toBe(a.schedule)
    expect(JSON.parse(h.db.get('B')!.schedule!)[0].imageUrl).toContain('n-1')
  })

  it('한 번 실행의 교체 상한을 넘는 건 다음 밤으로 미룬다(deferred)', async () => {
    const total = NIGHTLY_MAX_REPLACEMENTS_PER_RUN + 3
    const p = product('A', '2026-01-01', Array.from({ length: total }, (_, i) => ({ url: `https://cdn.example.com/dead${i}.webp`, extId: String(1000 + i) })))
    const h = harness([p], { status: () => 404 })
    const r = await runPublicPhotoNightlyAudit(h.deps)
    expect(NIGHTLY_MAX_REPLACEMENTS_PER_RUN).toBe(10)
    expect(r.replaced).toHaveLength(NIGHTLY_MAX_REPLACEMENTS_PER_RUN)
    expect(r.deferred).toBe(3)
    expect(h.replaceNotes).toHaveLength(NIGHTLY_MAX_REPLACEMENTS_PER_RUN)
  })

  it('끝내 못 고친 칸만 예외 목록, 사진은 그대로', async () => {
    const p = product('A', '2026-01-01', [{ url: 'https://cdn.example.com/dead.webp', extId: '2' }])
    const acquire = async (i: AcquireInput): Promise<AcquireResult> => ({
      ok: false,
      skipped: false,
      tried: [],
      exception: { productId: i.productId, day: i.day, kind: i.kind, sight: 'Blue Mosque', query: 'q', reason: 'no_candidates', detail: 'rejects=-', origin: i.origin, at: 'now' },
    })
    const h = harness([p], { status: () => 404, acquire })
    const r = await runPublicPhotoNightlyAudit(h.deps)
    expect(r.replaced).toHaveLength(0)
    expect(r.exceptions).toHaveLength(1)
    expect(r.exceptions[0]!.detail).toContain('broken_http')
    expect(h.exceptions).toHaveLength(1)
    expect(h.db.get('A')!.schedule).toBe(p.schedule)
  })

  it('외부 장애(5xx·시간초과)는 교체하지 않고 SKIP 으로만 센다', async () => {
    const p = product('A', '2026-01-01', [{ url: 'https://cdn.example.com/slow.webp', extId: '2' }])
    const h = harness([p], { status: () => 503 })
    const r = await runPublicPhotoNightlyAudit(h.deps)
    expect(r.replaced).toHaveLength(0)
    expect(r.broken).toBe(0)
    expect(r.headSkipped).toEqual([{ url: 'https://cdn.example.com/slow.webp', reason: 'http_503' }])
    const t = harness([p], { status: () => 'throw' })
    expect((await runPublicPhotoNightlyAudit(t.deps)).replaced).toHaveLength(0)
  })

  it('관리자가 고른 칸은 깨져도 자동으로 바꾸지 않는다', async () => {
    const p = product('A', '2026-01-01', [{ url: 'https://cdn.example.com/dead.webp', extId: '2', manual: true }])
    const h = harness([p], { status: () => 404 })
    const r = await runPublicPhotoNightlyAudit(h.deps)
    expect(r.replaced).toHaveLength(0)
    expect(h.db.get('A')!.schedule).toBe(p.schedule)
  })

  it('외부 호출은 순차(동시 없음)이고 호출마다 간격(pause)을 둔다', async () => {
    const p = product('A', '2026-01-01', [
      { url: 'https://cdn.example.com/a.webp', extId: '1' },
      { url: 'https://cdn.example.com/b.webp', extId: '2' },
      { url: 'https://cdn.example.com/c.webp', extId: '3' },
    ])
    const h = harness([p])
    await runPublicPhotoNightlyAudit(h.deps)
    expect(h.stats().maxInFlight).toBe(1)
    expect(h.stats().pauses).toBeGreaterThanOrEqual(3)
  })

  it('다른 상품이 같은 사진을 같이 쓰면 한 번만 확인한다(HEAD 캐시)', async () => {
    const a = product('A', '2026-01-01', [{ url: 'https://cdn.example.com/same.webp', extId: '1' }])
    const b = product('B', '2026-02-01', [{ url: 'https://cdn.example.com/same.webp', extId: '2' }])
    const h = harness([a, b])
    await runPublicPhotoNightlyAudit(h.deps)
    expect(h.heads.filter((u) => u.endsWith('same.webp'))).toHaveLength(1)
  })
})
