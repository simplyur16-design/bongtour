import { describe, expect, it } from 'vitest'
import {
  buildRegisterProductFactWrite,
  deriveAirlineFact,
  deriveHotelMealFact,
  deriveOptionalFact,
  deriveShoppingFact,
  extractHotelStarGrade,
  formatCompareMealSlotsLabel,
  formatFactTriState,
  optionalScalarFromRegisterParsed,
  shoppingScalarsFromRegisterParsed,
} from '@/lib/supplier-product-fact-ssot'

// REGRESSION-FREEZE[supplier-product-fact-ssot]: 사실 필드 도출 — manifest
describe('shoppingScalarsFromRegisterParsed', () => {
  it('hasShopping false → 0/0 (null 금지)', () => {
    expect(shoppingScalarsFromRegisterParsed({ hasShopping: false, shoppingVisitCount: null })).toEqual({
      shoppingCount: 0,
      shoppingVisitCountTotal: 0,
    })
  })

  it('방문 횟수 있으면 동기화', () => {
    expect(shoppingScalarsFromRegisterParsed({ hasShopping: true, shoppingVisitCount: 2 })).toEqual({
      shoppingCount: 2,
      shoppingVisitCountTotal: 2,
    })
  })
})

describe('optionalScalarFromRegisterParsed', () => {
  it('false를 null로 지우지 않음', () => {
    expect(optionalScalarFromRegisterParsed({ hasOptionalTour: false })).toBe(false)
    expect(optionalScalarFromRegisterParsed({ hasOptionalTour: true })).toBe(true)
    expect(optionalScalarFromRegisterParsed({ hasOptionalTour: null })).toBeNull()
  })
})

describe('deriveShoppingFact', () => {
  it('스칼라 0 → 없음', () => {
    const f = deriveShoppingFact({ shoppingCount: 0, shoppingVisitCountTotal: 0 })
    expect(f.state).toBe('no')
    expect(formatFactTriState(f.state, f.visitCount)).toBe('없음')
  })

  it('제목 노쇼핑 → 없음', () => {
    const f = deriveShoppingFact({ title: '방콕 5일 #노쇼핑노옵션', shoppingCount: null })
    expect(f.state).toBe('no')
    expect(f.visitCount).toBe(0)
  })

  it('ybtour 표 행 수로 보강', () => {
    const f = deriveShoppingFact({
      originSource: 'ybtour',
      shoppingShopOptions: JSON.stringify([
        { placeName: 'A', itemType: '보석' },
        { placeName: 'B', itemType: '면세' },
      ]),
    })
    expect(f.state).toBe('yes')
    expect(f.visitCount).toBe(2)
  })
})

describe('buildRegisterProductFactWrite', () => {
  it('Product 컬럼과 rawMeta structuredSignals 정합', () => {
    const w = buildRegisterProductFactWrite({
      hasShopping: false,
      shoppingVisitCount: null,
      hasOptionalTour: false,
      hotelSummaryText: '조식 호텔식',
    })
    expect(w.shoppingCount).toBe(0)
    expect(w.shoppingVisitCountTotal).toBe(0)
    expect(w.hasOptionalTours).toBe(false)
    expect(w.optionalToursStructured).toBeNull()
    expect(w.hotelSummaryText).toBeNull()
    expect(w.structuredSignalsFacts).toEqual({
      hasShopping: false,
      shoppingVisitCount: 0,
      hasOptionalTour: false,
    })
  })

  it('canonical 옵션 행 → structured 첨부 + hasOptionalTours true (자유여행 포함)', () => {
    const w = buildRegisterProductFactWrite({
      hasShopping: false,
      hasOptionalTour: null,
      optionalToursStructured: null,
      detailBodyStructured: {
        optionalToursStructured: { rows: [{ tourName: '헬기투어', adultPrice: 100 }] },
      },
    })
    expect(w.hasOptionalTours).toBe(true)
    expect(w.optionalToursStructured).toContain('헬기투어')
  })

  it('쇼핑 N회 → 스칼라·signals 동일', () => {
    const w = buildRegisterProductFactWrite({
      hasShopping: true,
      shoppingVisitCount: 3,
      hasOptionalTour: true,
      hotelSummaryText: 'HOTEL VISTA Matsuyama',
    })
    expect(w.shoppingCount).toBe(3)
    expect(w.structuredSignalsFacts.shoppingVisitCount).toBe(3)
    expect(w.structuredSignalsFacts.hasShopping).toBe(true)
    expect(w.hasOptionalTours).toBe(true)
    expect(w.hotelSummaryText).toMatch(/VISTA|Matsuyama/i)
  })
})

describe('compare meal slots + hotel star', () => {
  it('조·중·석 포함·불포함 명시', () => {
    expect(
      formatCompareMealSlotsLabel([
        { breakfastText: null, lunchText: '기내식', dinnerText: '현지식' },
        { breakfastText: '호텔식', lunchText: '불포함', dinnerText: '불포함' },
      ]),
    ).toBe('조식 포함 · 중식 포함 · 석식 포함')
    expect(
      formatCompareMealSlotsLabel([
        { mealSummaryText: '조식 - 호텔식, 중식 - 불포함, 석식 - 불포함' },
      ]),
    ).toBe('조식 포함 · 중식 불포함 · 석식 불포함')
    expect(
      formatCompareMealSlotsLabel([{ breakfastText: '조식 불포함', lunchText: null, dinnerText: null }]),
    ).toBe('조식 불포함')
  })

  it('호텔명 + 제목 성급', () => {
    expect(extractHotelStarGrade('상해 쑤닝 노보텔 호텔 3박4일 (준5성급)')).toBe('준5성급')
    const hm = deriveHotelMealFact({
      title: '상해 쑤닝 노보텔 호텔 3박4일 (준5성급)',
      hotelSummaryText: '상하이 쑤닝 노보텔 호텔',
      itineraryDays: [],
    })
    expect(hm.hotelLabel).toBe('상하이 쑤닝 노보텔 호텔 (준5성급)')
    expect(hm.hotelStarGrade).toBe('준5성급')
  })

  it('도시+예정호텔 문장은 정보 없음', () => {
    const hm = deriveHotelMealFact({
      hotelSummaryText: '상하이 예정 호텔(동급 가능)',
      itineraryDays: [{ hotelText: '상하이 예정 호텔(동급 가능)' }],
    })
    expect(hm.hotelLabel).toBe('정보 없음')
  })
})

describe('deriveAirlineFact', () => {
  it('departureKeyFacts.airline 최우선 (상세·비교 동일)', () => {
    const f = deriveAirlineFact({
      departureKeyFactsAirline: 'KE',
      departures: [{ carrierName: 'TW' }],
      rawMeta: JSON.stringify({
        structuredSignals: { airlineName: '대한항공' },
      }),
    })
    expect(f.airlineLabel).toBe('대한항공')
    expect(f.source).toBe('departure_key_facts')
  })

  it('출발행 carrierName 우선 + IATA 한글', () => {
    const f = deriveAirlineFact({
      departures: [{ carrierName: 'TW' }],
      rawMeta: JSON.stringify({
        structuredSignals: { airlineName: '대한항공' },
      }),
    })
    expect(f.airlineLabel).toBe('트리니티항공')
    expect(f.source).toBe('departure_carrier')
  })

  it('출발행 없으면 structured airlineName', () => {
    const f = deriveAirlineFact({
      departures: [],
      rawMeta: JSON.stringify({
        structuredSignals: { airlineName: '아시아나항공' },
      }),
    })
    expect(f.airlineLabel).toBe('아시아나항공')
    expect(f.source).toBe('structured_airline')
  })

  it('상담 시·없으면 정보 없음 (발명 금지)', () => {
    expect(deriveAirlineFact({}).airlineLabel).toBe('정보 없음')
    expect(
      deriveAirlineFact({ departureKeyFactsAirline: '상담 시 안내' }).airlineLabel,
    ).toBe('정보 없음')
  })
})

describe('hotel heading scrub + FIT meal', () => {
  it('날씨 및 호텔 섹션 제목은 호텔칸 거부', () => {
    const hm = deriveHotelMealFact({
      hotelSummaryText: '날씨 및 호텔',
      itineraryDays: [{ hotelText: '날씨 및 호텔' }],
    })
    expect(hm.hotelLabel).toBe('정보 없음')
  })

  it('FIT 비교 식사칸은 예시일정 조중석을 쓰지 않음', () => {
    const hm = deriveHotelMealFact({
      listingKind: 'air_hotel_free',
      slug: 'fit-nl-0007',
      itineraryDays: [
        {
          breakfastText: '호텔식',
          lunchText: '현지식',
          dinnerText: '특식',
        },
      ],
    })
    expect(hm.mealLabel).not.toMatch(/중식|석식/)
    expect(hm.mealLabel).toBe('상담 시 안내')
  })

  it('FIT meal: 조식 포함 명시 → 호텔 조식', () => {
    const hm = deriveHotelMealFact({
      listingKind: 'air_hotel_free',
      slug: 'fit-xx-0001',
      hotelSummaryText: '노보텔 다낭 · 조식 포함',
      itineraryDays: [],
    })
    expect(hm.mealLabel).toBe('호텔 조식')
  })

  it('FIT meal: room only → 상담 시 안내', () => {
    const hm = deriveHotelMealFact({
      listingKind: 'air_hotel_free',
      slug: 'fit-xx-0002',
      hotelSummaryText: 'Room only / 룸온리',
      itineraryDays: [{ breakfastText: '불포함' }],
    })
    expect(hm.mealLabel).toBe('상담 시 안내')
  })

  it('FIT meal: unknown → 상담 시 안내 (정보 없음 아님)', () => {
    const hm = deriveHotelMealFact({
      listingKind: 'air_hotel_free',
      slug: 'fit-xx-0003',
      itineraryDays: [],
    })
    expect(hm.mealLabel).toBe('상담 시 안내')
    expect(hm.mealLabel).not.toBe('정보 없음')
  })

  it('FIT meal: 불포함/미포함 조식 문구 → 상담 시 안내 (호텔 조식 금지)', () => {
    const negatives = [
      '불포함: 조식',
      '불포함 조식',
      '불포함사항: 조식',
      '조식 불포함',
      '조식불포함',
      '조식 미포함',
      'breakfast not included',
      'room only',
    ]
    for (const hotelSummaryText of negatives) {
      const hm = deriveHotelMealFact({
        listingKind: 'air_hotel_free',
        slug: 'fit-neg-break',
        hotelSummaryText,
        itineraryDays: [],
      })
      expect(hm.mealLabel, hotelSummaryText).toBe('상담 시 안내')
      expect(hm.mealLabel, hotelSummaryText).not.toBe('호텔 조식')
    }
  })

  it('FIT meal: 긍정 조식 포함 문구 → 호텔 조식', () => {
    const positives = ['조식 포함', '조식포함', 'breakfast included', '포함: 조식']
    for (const hotelSummaryText of positives) {
      const hm = deriveHotelMealFact({
        listingKind: 'air_hotel_free',
        slug: 'fit-pos-break',
        hotelSummaryText,
        itineraryDays: [],
      })
      expect(hm.mealLabel, hotelSummaryText).toBe('호텔 조식')
    }
  })
})

describe('deriveOptionalFact', () => {
  it('hasOptionalTours false → 없음', () => {
    expect(deriveOptionalFact({ hasOptionalTours: false }).state).toBe('no')
  })

  it('structured 행 → 있음', () => {
    const f = deriveOptionalFact({
      hasOptionalTours: null,
      optionalToursStructured: JSON.stringify({ rows: [{ tourName: '시티투어' }] }),
    })
    expect(f.state).toBe('yes')
    expect(f.rowCount).toBe(1)
  })

  it('제목 노옵션 → 없음', () => {
    expect(deriveOptionalFact({ title: '다낭 #노옵션NO팁' }).state).toBe('no')
  })

  it('제목 #NO옵션 → 없음 (영문 해시태그)', () => {
    expect(deriveOptionalFact({ title: '[발칸] #NO쇼핑/NO옵션 #두브로브니크' }).state).toBe('no')
  })

  it('제목 #NO쇼핑 → 쇼핑 없음', () => {
    expect(deriveShoppingFact({ title: '[발칸] #NO쇼핑/NO옵션' }).state).toBe('no')
  })
})
