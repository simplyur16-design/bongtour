import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { pickTalktalkCompareCandidates } from '@/lib/talktalk-draft/compare-candidates'
import { parseTalktalkInquiryText } from '@/lib/talktalk-draft/parse-inquiry'
import type { CompareWeekDepartureInput } from '@/lib/similar-itinerary-compare-week'

const BASE = new Date('2026-11-16T00:00:00.000Z')

function dep(
  id: string,
  ymd: string,
  adultPrice: number | null,
  seatCount: number | null,
): CompareWeekDepartureInput {
  return {
    id,
    departureDate: new Date(`${ymd}T00:00:00.000Z`),
    adultPrice,
    seatCount,
    isBookable: true,
  }
}

function product(opts: {
  id: string
  origin: string
  place?: string
  adult: number | null
  seats: number | null
  ymd?: string
  duration?: string
}) {
  return {
    id: opts.id,
    title: `${opts.place ?? '오사카'} 상품`,
    slug: opts.id,
    originSource: opts.origin,
    primaryDestination: opts.place ?? '오사카',
    destination: opts.place ?? '오사카',
    duration: opts.duration ?? '3박 4일',
    departures: [dep(opts.id, opts.ymd ?? '2026-12-09', opts.adult, opts.seats)],
  }
}

describe('pickTalktalkCompareCandidates', () => {
  const products = [
    product({ id: 'yb', origin: 'ybtour', adult: 900000, seats: null }),
    product({ id: 'lt', origin: 'lottetour', adult: 1100000, seats: 6 }),
    product({ id: 'hn', origin: 'hanatour', adult: 1200000, seats: 4 }),
    product({ id: 'mt', origin: 'modetour', adult: 1300000, seats: 2 }),
    product({ id: 'vg', origin: 'verygoodtour', adult: 2000000, seats: 10 }),
    product({ id: 'other', origin: 'hanatour', place: '후쿠오카', adult: 800000, seats: 9 }),
    product({ id: 'unknown', origin: 'not-a-supplier', adult: 500000, seats: 9 }),
  ]

  it('같은 주·예산·인원 안에서 공급사별로 싼 저장 가격 최대 3개', () => {
    const result = pickTalktalkCompareCandidates({
      destination: '오사카',
      departureDate: '2026-12-10',
      budgetKrw: 1600000,
      partySize: 3,
      products,
      baseDate: BASE,
    })
    expect(result.candidates.map((c) => c.productId)).toEqual(['yb', 'lt', 'hn'])
    expect(result.candidates.map((c) => c.priceLabel)).toEqual(['900,000원', '1,100,000원', '1,200,000원'])
    expect(result.candidates[0]?.seatsLabel).toBe('문의')
    expect(result.candidates[1]?.seatsLabel).toBe('6')
    expect(result.candidates[0]?.departureDate).toBe('2026-12-09')
    expect(result.weekFellBack).toBe(false)
  })

  it('가격이 없으면 금액을 만들지 않는다', () => {
    const result = pickTalktalkCompareCandidates({
      destination: '오사카',
      departureDate: '2026-12-10',
      products: [product({ id: 'empty', origin: 'hanatour', adult: null, seats: 5 })],
      baseDate: BASE,
    })
    expect(result.candidates).toEqual([])
  })

  it('박일이 있으면 다른 일정 길이는 뺀다', () => {
    const result = pickTalktalkCompareCandidates({
      destination: '오사카',
      departureDate: '2026-12-10',
      duration: '3박 4일',
      products: [
        product({ id: 'short', origin: 'hanatour', adult: 1000000, seats: 5, duration: '3박 4일' }),
        product({ id: 'long', origin: 'modetour', adult: 900000, seats: 5, duration: '8박 9일' }),
      ],
      baseDate: BASE,
    })
    expect(result.candidates.map((c) => c.productId)).toEqual(['short'])
  })
})

describe('parseTalktalkInquiryText', () => {
  it('출발일·예산·인원·박일만 읽고 가격을 추정하지 않는다', () => {
    const parsed = parseTalktalkInquiryText('오사카 2026년 12월 8일 3박 4일 성인 2명 예산 150만원')
    expect(parsed.departureDate).toBe('2026-12-08')
    expect(parsed.budgetKrw).toBe(1500000)
    expect(parsed.partySize).toBe(2)
    expect(parsed.duration).toBe('3박 4일')
    expect(parsed.destination).toBeNull()
  })
})

describe('talktalk draft route has no send path', () => {
  it('관리자 초안 라우트는 발송·모델 호출을 넣지 않는다', () => {
    const src = readFileSync('app/api/admin/talktalk-draft/route.ts', 'utf8')
    expect(src).toContain('requireAdmin')
    expect(src).toContain('sent: false')
    expect(src).not.toMatch(/sendStaffInquiryReply|solapi|openai|naver-talktalk|webhook/)
  })
})
