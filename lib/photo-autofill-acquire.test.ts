import { describe, expect, it } from 'vitest'
import { acquireVerifiedPhoto, type AcquireDeps, type AcquireInput } from '@/lib/photo-autofill-acquire'
import { AUTOFILL_MAX_CANDIDATES_PER_SLOT, buildPublicPhotoUsage, PublicPhotoUsage, type AutofillCandidate } from '@/lib/photo-autofill-gate'

function cand(id: string, over: Partial<AutofillCandidate> = {}): AutofillCandidate {
  return {
    id,
    source: 'Pexels',
    url: `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg`,
    width: 4000,
    height: 2600,
    photographer: 'Jane Doe',
    originalLink: `https://www.pexels.com/photo/blue-mosque-in-istanbul-${id}/`,
    altText: 'Blue Mosque in Istanbul at sunset',
    tags: [],
    ...over,
  }
}

type Call = { type: 'search' | 'commit' | 'pause'; tier?: string; query?: string; id?: string }

function makeDeps(opts: {
  results?: (tier: string, query: string, n: number) => AutofillCandidate[] | Error
  stopped?: (tier: string) => boolean
  commit?: (c: AutofillCandidate) => { ok: true; bytes: number; width: number } | { ok: false; reason: string }
}) {
  const calls: Call[] = []
  let inFlight = 0
  let maxInFlight = 0
  let searchCount = 0
  const track = async <T,>(fn: () => T | Promise<T>): Promise<T> => {
    inFlight++
    maxInFlight = Math.max(maxInFlight, inFlight)
    try {
      await Promise.resolve()
      return await fn()
    } finally {
      inFlight--
    }
  }
  const deps: AcquireDeps = {
    stockStopped: (tier) => opts.stopped?.(tier) ?? false,
    pause: async () => {
      calls.push({ type: 'pause' })
    },
    search: async (tier, query, n) =>
      track(() => {
        calls.push({ type: 'search', tier, query })
        searchCount++
        const r = opts.results ? opts.results(tier, query, searchCount) : []
        if (r instanceof Error) throw r
        return r
      }),
    commit: async (c) =>
      track(() => {
        calls.push({ type: 'commit', id: c.id })
        const r = opts.commit?.(c) ?? { ok: true as const, bytes: 150_000, width: 1800 }
        if (!r.ok) return r
        return {
          ok: true as const,
          url: `https://cdn.example.com/photo-pool/${c.id}.webp`,
          bytes: r.bytes,
          width: r.width,
          source: c.source,
          photographer: c.photographer ?? '',
          originalLink: c.originalLink ?? '',
          externalId: c.id,
        }
      }),
  }
  return { deps, calls, stats: () => ({ maxInFlight, searchCount }) }
}

const base = (over: Partial<AcquireInput> = {}): AcquireInput => ({
  productId: 'p-new',
  kind: 'day',
  day: 2,
  dayFacts: { title: '이스탄불', routeText: '이스탄불 - 블루모스크 - 그랜드바자르', description: null, imageKeyword: null, imageKeyword2: null },
  cityTerms: ['istanbul'],
  destinationText: '이스탄불 터키 istanbul',
  usage: new PublicPhotoUsage(),
  origin: 'autofill',
  ...over,
})

describe('acquireVerifiedPhoto: 방문지 검증 채택', () => {
  it('통과 후보를 올리고 근거(sight/matched)를 돌려준다', async () => {
    const { deps } = makeDeps({ results: (tier) => (tier === 'pexels' ? [cand('1')] : []) })
    const r = await acquireVerifiedPhoto(base(), deps)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.photo.sight.toLowerCase()).toContain('blue mosque')
      expect(r.photo.matched).toBeTruthy()
      expect(r.photo.externalId).toBe('1')
    }
  })

  it('Pexels → Unsplash 순서, 검색은 순차(동시 호출 없음)·호출 전 pause', async () => {
    const { deps, calls, stats } = makeDeps({ results: () => [] })
    const r = await acquireVerifiedPhoto(base(), deps)
    expect(r.ok).toBe(false)
    const searches = calls.filter((c) => c.type === 'search')
    expect(searches[0]!.tier).toBe('pexels')
    expect(searches[1]!.tier).toBe('unsplash')
    expect(stats().maxInFlight).toBe(1)
    calls.forEach((c, i) => {
      if (c.type === 'search') expect(calls[i - 1]?.type).toBe('pause')
    })
  })

  it('Pexels 에 없으면 Unsplash 후보를 채택(AI 생성은 없다)', async () => {
    const { deps } = makeDeps({
      results: (tier) => (tier === 'unsplash' ? [cand('u1', { source: 'Unsplash', url: 'https://images.unsplash.com/photo-u1', originalLink: 'https://unsplash.com/photos/blue-mosque-u1' })] : []),
    })
    const r = await acquireVerifiedPhoto(base(), deps)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.photo.source).toBe('Unsplash')
  })

  it('읽기는 한 번만 재시도하고, 계속 실패하면 그 출처는 _error 로 남긴다', async () => {
    const { deps, stats } = makeDeps({ results: () => new Error('boom') })
    const r = await acquireVerifiedPhoto(base({ sights: ['Blue Mosque'] }), deps)
    expect(r.ok).toBe(false)
    // 검색어 2개 × 출처 2개 × (최초 + 재시도 1회)
    expect(stats().searchCount).toBe(2 * 2 * 2)
    if (!r.ok) expect(r.exception.detail).toContain('pexels_error')
  })

  it('Unsplash 시간당 한도(중단)는 그 칸의 예외 사유로 남기고 계속 진행', async () => {
    const { deps } = makeDeps({ results: () => [], stopped: (t) => t === 'unsplash' })
    const r = await acquireVerifiedPhoto(base(), deps)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.skipped).toBe(false)
      expect(r.exception.reason).toBe('unsplash_limit')
    }
  })

  it('후보는 칸당 5개까지만 검토하고, 못 고치면 candidate_cap 예외', async () => {
    const list = ['1', '2', '3', '4', '5', '6', '7'].map((id) => cand(id))
    const { deps, calls } = makeDeps({ results: (tier) => (tier === 'pexels' ? list : []), commit: () => ({ ok: true, bytes: 900_000, width: 1800 }) })
    const r = await acquireVerifiedPhoto(base(), deps)
    expect(r.ok).toBe(false)
    expect(calls.filter((c) => c.type === 'commit').length).toBe(AUTOFILL_MAX_CANDIDATES_PER_SLOT)
    if (!r.ok) expect(r.exception.reason).toBe('candidate_cap')
  })

  it('올린 뒤 저장본이 400,000B 이상이면 채택하지 않고 다음 후보로', async () => {
    const sizes: Record<string, number> = { '1': 450_000, '2': 120_000 }
    const { deps } = makeDeps({ results: (tier) => (tier === 'pexels' ? [cand('1'), cand('2')] : []), commit: (c) => ({ ok: true, bytes: sizes[c.id]!, width: 1800 }) })
    const r = await acquireVerifiedPhoto(base(), deps)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.photo.externalId).toBe('2')
  })

  it('대표는 저장본 200,000B 미만이어야 한다', async () => {
    const { deps } = makeDeps({ results: (tier) => (tier === 'pexels' ? [cand('1')] : []), commit: () => ({ ok: true, bytes: 250_000, width: 1800 }) })
    const r = await acquireVerifiedPhoto(base({ kind: 'cover', day: null, sights: ['Blue Mosque'] }), deps)
    expect(r.ok).toBe(false)
  })

  it('공개 상품이 쓰는 사진은 건너뛰고 다른 후보를 채택', async () => {
    const usage = buildPublicPhotoUsage([{ productId: 'p-public', bgImageUrl: null, schedule: JSON.stringify([{ day: 1, imageUrl: cand('1').url, imageSource: { externalId: '1' } }]) }])
    const { deps } = makeDeps({ results: (tier) => (tier === 'pexels' ? [cand('1'), cand('2')] : []) })
    const r = await acquireVerifiedPhoto(base({ usage }), deps)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.photo.externalId).toBe('2')
  })

  it('같은 상품이 이미 쓴 사진(exclude)은 다시 고르지 않는다', async () => {
    const { deps } = makeDeps({ results: (tier) => (tier === 'pexels' ? [cand('1'), cand('2')] : []) })
    const r = await acquireVerifiedPhoto(base({ exclude: new Set(['id:1']) }), deps)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.photo.externalId).toBe('2')
  })

  it('방문지가 없는 날은 검색하지 않고 skipped(예외 목록 대상 아님)', async () => {
    const { deps, stats } = makeDeps({ results: () => [cand('1')] })
    const r = await acquireVerifiedPhoto(
      base({ dayFacts: { title: '인천 출발', routeText: '인천 출발 - 방콕 도착', description: null, imageKeyword: null, imageKeyword2: null } }),
      deps,
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.skipped).toBe(true)
    expect(stats().searchCount).toBe(0)
  })

  it('후보가 모두 이름 불일치면 탈락 사유가 예외에 남는다', async () => {
    const { deps } = makeDeps({ results: (tier) => (tier === 'pexels' ? [cand('1', { altText: 'Plate of food', originalLink: 'https://www.pexels.com/photo/plate-of-food-1/' })] : []) })
    const r = await acquireVerifiedPhoto(base(), deps)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.skipped).toBe(false)
      expect(r.exception.reason).toBe('no_sight_match')
      expect(r.exception.productId).toBe('p-new')
      expect(r.exception.day).toBe(2)
    }
  })
})
