/**
 * 사장님 11/27 21:31 '사진 코드 수정 검사 통과하면 병합·배포해' / '국내 6개는 등록대기에서 빼라'
 * REGRESSION-FREEZE[photo-sight-core-1127]: 고유명 축약 검색어·고유명 낱말 대조 — manifest
 * REGRESSION-FREEZE[photo-title-landmark-1127]: 빈·도시만 키워드는 제목 첫 명소로 검색 — manifest
 * REGRESSION-FREEZE[photo-source-order-1127]: 풀 → Pexels → CC0·PD → Unsplash. AI 생성 금지 — manifest
 * REGRESSION-FREEZE[photo-openverse-cc0-1127]: Openverse cc0·pdm 만 — manifest
 * REGRESSION-FREEZE[pool-origin-source-1127]: 풀 원 출처 기록(L2-OTHER-SOURCE 원인) — manifest
 * REGRESSION-FREEZE[pool-citymatch-1127]: 풀 채택 via=pool → cityMatch pool — manifest
 * REGRESSION-FREEZE[unsplash-share-1127]: 풀 보충 Unsplash 몫 15 — manifest
 * REGRESSION-FREEZE[domestic-pending-exclude-1127]: 국내여행 등록대기 제외 — manifest
 */
import { describe, expect, it } from 'vitest'
import {
  deriveDaySights,
  sightCoreQuery,
  sightMatchInText,
  sightProfile,
  sightSearchQueries,
  titleFirstLandmarkSight,
} from '@/lib/photo-autofill-sight'
import { openverseRowsToCandidates } from '@/lib/photo-autofill-openverse'
import { poolRowOriginSource } from '@/lib/photo-autofill-live-deps'
import { checkDayPhotoPolicy } from '@/lib/register-day-photo-policy'
import { UNSPLASH_TOPUP_SHARE_PER_HOUR, UnsplashCallBudget } from '@/lib/register-photo-stock-rate-guard'
import { isRegisterIngestDomesticKoreaProduct } from '@/lib/register-ingest-reject-domestic-korea'
import { computeRegisterPrePhotoQueueFlags } from '@/lib/register-pre-photo-queue-flags'
import { acquireVerifiedPhoto, type AcquireDeps } from '@/lib/photo-autofill-acquire'
import { PublicPhotoUsage, type AutofillCandidate } from '@/lib/photo-autofill-gate'

describe('고유명 축약·대조 (photo-sight-core-1127)', () => {
  it('긴 키워드는 설명 낱말·도시를 떼어 축약 검색어를 더한다', () => {
    expect(sightCoreQuery('Karnak Temple Luxor Columns')).toBe('Karnak Temple')
    expect(sightCoreQuery('Changbai Mountain Heaven Lake')).toBe('Changbai Mountain')
    expect(sightCoreQuery('Bayon Temple Angkor Thom')).toBe('Bayon Temple')
    expect(sightCoreQuery('Wat Arun')).toBe('')
    // 사장님 08:55: 도시를 자동으로 붙이지 않는다
    expect(sightSearchQueries('Karnak Temple Luxor Columns')).toEqual(['Karnak Temple Luxor Columns', 'Karnak Temple'])
  })

  it('고유명 낱말이 있으면 설명 낱말이 없어도 일치, 고유명이 없으면 불일치', () => {
    const p = sightProfile('Karnak Temple Luxor Columns')
    expect(sightMatchInText(p, 'Karnak temple at sunset')).toBe('core:karnak')
    expect(sightMatchInText(p, 'Luxor temple columns')).toBeNull()
    expect(sightMatchInText(sightProfile('Changbai Mountain Heaven Lake'), 'Tianchi lake on Changbai')).toBe('core:changbai')
  })

  it('일반어·짧은 낱말만으로는 일치하지 않는다(도시 앵커 규칙 유지)', () => {
    expect(sightMatchInText(sightProfile('Wat Arun'), 'arun river boat')).toBeNull()
    expect(sightMatchInText(sightProfile('Old Town Square'), 'old town square at night')).toBeNull()
    expect(sightMatchInText(sightProfile('Blue Mosque'), 'blue mosque')).toBeNull()
    // 5자 고유명은 도시 앵커가 있어야
    const bayon = sightProfile('Bayon Temple Angkor Thom')
    expect(sightMatchInText(bayon, 'Bayon faces')).toBeNull()
    expect(sightMatchInText(bayon, 'Bayon faces Siem Reap', ['siem reap'])).toBe('core:bayon')
  })
})

describe('제목 첫 명소 보강 (photo-title-landmark-1127)', () => {
  it('도시만 키워드면 제목의 첫 명소(한→영)로, 이동·호텔 조각은 건너뛴다', () => {
    expect(titleFirstLandmarkSight('방콕 · 왓아룬 · 왕궁')).toBe('Wat Arun')
    expect(titleFirstLandmarkSight('호텔 조식 후 공항 이동')).toBeNull()
    const d = deriveDaySights({ title: '방콕 · 왓아룬', routeText: null, description: null, imageKeyword: 'Bangkok' }, '방콕')
    expect(d.sights).toEqual(['Wat Arun'])
  })
})

describe('Openverse CC0·PD (photo-openverse-cc0-1127)', () => {
  it('cc0·pdm 만 남기고 CC BY 는 버린다', () => {
    const rows = openverseRowsToCandidates({
      results: [
        { id: 'a', title: 'Karnak temple', url: 'https://x.org/a.jpg', license: 'cc0', width: 3000, height: 2000, foreign_landing_url: 'https://flickr.com/a' },
        { id: 'b', title: 'Karnak temple', url: 'https://x.org/b.jpg', license: 'by', width: 3000, height: 2000 },
        { id: 'c', title: 'Karnak temple', url: 'https://x.org/c.jpg', license: 'pdm', width: 3000, height: 2000 },
        { id: 'd', title: 'Karnak temple', url: 'https://x.org/d.jpg', license: 'by-sa', width: 3000, height: 2000 },
      ],
    })
    expect(rows.map((r) => r.id)).toEqual(['ov-a', 'ov-c'])
    expect(rows.every((r) => r.source === 'CC0')).toBe(true)
  })
})

describe('풀 원 출처 (pool-origin-source-1127)', () => {
  it('풀 행 원 출처를 정책이 아는 이름으로, 모르면 null', () => {
    expect(poolRowOriginSource('pexels', null)).toBe('Pexels')
    expect(poolRowOriginSource('PhotoPool', 'https://commons.wikimedia.org/wiki/File:A.jpg')).toBe('CC0')
    expect(poolRowOriginSource('PhotoPool', 'https://www.pexels.com/photo/a-1/')).toBe('Pexels')
    expect(poolRowOriginSource('Gemini', '')).toBeNull()
    expect(poolRowOriginSource('manual-upload', '')).toBeNull()
  })

  it("'PhotoPool' 출처 이름은 일차 정책이 L2-OTHER-SOURCE 로 막고, 원 출처 CC0 는 통과한다", () => {
    const base = { url: 'https://cdn.example.com/photo-pool/a.webp', photographer: 'x', originalLink: 'https://commons.wikimedia.org/wiki/File:A.jpg', width: 2000, bytes: 200_000 }
    expect(checkDayPhotoPolicy({ ...base, source: 'PhotoPool' }).reasons).toContain('policy:L2-OTHER-SOURCE')
    expect(checkDayPhotoPolicy({ ...base, source: 'CC0' }).ok).toBe(true)
  })
})

describe('Unsplash 몫 분리 (unsplash-share-1127)', () => {
  it('풀 보충 몫은 시간당 15', () => {
    expect(UNSPLASH_TOPUP_SHARE_PER_HOUR).toBe(15)
    const b = new UnsplashCallBudget({ now: () => 0, sleep: async () => {} }, UNSPLASH_TOPUP_SHARE_PER_HOUR)
    for (let i = 0; i < 15; i++) expect(b.tryAcquire()).toBe(true)
    expect(b.tryAcquire()).toBe(false)
  })
})

describe('출처 순서·풀 축약 조회 (photo-source-order-1127)', () => {
  it('풀은 원래 이름과 축약 이름으로 찾고, Pexels → CC0 → Unsplash 순, 생성은 부르지 않는다', async () => {
    const order: string[] = []
    const deps: AcquireDeps = {
      stockStopped: () => false,
      pause: async () => {},
      lookupPool: async (sight) => {
        order.push(`pool:${sight}`)
        return []
      },
      search: async (tier, q) => {
        order.push(`${tier}:${q}`)
        return []
      },
      searchCc0: async (q) => {
        order.push(`cc0:${q}`)
        return []
      },
      generate: async () => {
        order.push('generate')
        return null
      },
      commit: async () => ({ ok: false, reason: 'x' }),
    }
    const r = await acquireVerifiedPhoto(
      {
        productId: 'p',
        kind: 'day',
        day: 2,
        sights: ['Karnak Temple Luxor Columns'],
        cityTerms: ['luxor'],
        destinationText: 'luxor egypt',
        usage: new PublicPhotoUsage(),
        origin: 'autofill',
      },
      deps,
    )
    expect(r.ok).toBe(false)
    expect(order.slice(0, 2)).toEqual(['pool:Karnak Temple Luxor Columns', 'pool:Karnak Temple'])
    const idx = (p: string) => order.findIndex((x) => x.startsWith(p))
    expect(idx('pexels:')).toBeLessThan(idx('cc0:'))
    expect(idx('cc0:')).toBeLessThan(idx('unsplash:'))
    expect(order).not.toContain('generate')
    expect(order).toContain('pexels:Karnak Temple')
  })

  it('풀 채택 결과는 via=pool 로 돌려준다(cityMatch pool 근거)', async () => {
    const poolCand: AutofillCandidate = {
      id: 'pp1',
      source: 'PhotoPool',
      poolOriginSource: 'Pexels',
      url: 'https://cdn.example.com/photo-pool/k.webp',
      width: 2400,
      height: 1600,
      photographer: 'a',
      originalLink: 'https://www.pexels.com/photo/karnak-temple-1/',
      altText: 'karnak temple',
      storedBytes: 200_000,
    }
    const deps: AcquireDeps = {
      stockStopped: () => false,
      pause: async () => {},
      lookupPool: async () => [poolCand],
      search: async () => [],
      commit: async (c) => ({ ok: true, url: c.url, bytes: 200_000, width: 2400, source: c.poolOriginSource ?? c.source, photographer: 'a', originalLink: String(c.originalLink), externalId: c.id }),
    }
    const r = await acquireVerifiedPhoto(
      { productId: 'p', kind: 'day', day: 2, sights: ['Karnak Temple Luxor Columns'], cityTerms: ['luxor'], destinationText: 'luxor', usage: new PublicPhotoUsage(), origin: 'autofill' },
      deps,
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.photo.via).toBe('pool')
      expect(r.photo.source).toBe('Pexels')
    }
  })
})

describe('국내여행 등록대기 제외 (domestic-pending-exclude-1127)', () => {
  const six: Array<[string, string, string | null]> = [
    ['[연합상품][KTX]남해/순천/여수 2일 #남쪽나라명소 #보리암 #독일마을 #오동도', '금산 보리암 · 독일마을 외', 'singapore'],
    ['[내나라여행] 다도해일주 3일 #해남/진도/목포/완도/강진/정읍 #슬로시티 청산도', '명량 해상 케이블카 · 진도타워 외', 'china'],
    ['[연합상품][KTX]거제/밀양/남해/여수 3일 #한려수도 #완전일주 #외도보타니아', '영남루 · 외도해상농원 외', null],
    ['[연합상품][KTX] 영주/안동/봉화 2일#경북별미 #협곡열차 #월영교', '월영교 · 봉정사 외', null],
    ['[출발확정] [연합상품]산청 당일 #지리산 #웰니스 #동의보감촌 #무릉교출렁다리', '동의보감촌 · 대원사', null],
    ['[트레킹ㅣ웰니스] 영암/진도 2일#트레킹 #월출산 #접도웰빙코스 #아리랑시장', '월출산 · 접도 트레킹', null],
  ]
  it('하나투어 국내 6개는 국내로 판정', () => {
    for (const [t, d, c] of six) expect(isRegisterIngestDomesticKoreaProduct(t, d, c)).toBe(true)
  })
  it('해외 상품은 그대로(독일 여행·제주항공 보홀)', () => {
    expect(isRegisterIngestDomesticKoreaProduct('독일 일주 8일 #로맨틱가도', '뮌헨')).toBe(false)
    expect(isRegisterIngestDomesticKoreaProduct('[제주항공] 보홀 5일', '보홀')).toBe(false)
  })
  it('국내면 등록대기 큐 플래그가 켜지지 않는다', () => {
    const [t, d, c] = six[0]!
    const f = computeRegisterPrePhotoQueueFlags({ title: t, destination: d, countryKey: c, registrationStatus: 'pending', listingKind: 'travel', productType: 'travel', schedule: '[]' })
    expect(f.registerPrePhotoQueueReady).toBe(false)
  })
})
