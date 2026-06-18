import { describe, it, expect } from 'vitest'
import {
  extractThemes,
  groupCitiesByCountry,
  isFutureRecommendationMonth,
  matchProductIds,
  monthLabelFromNumber,
  monthToSeason,
  parseMonthNumber,
  parseTripRecommendationsFromGeminiRaw,
  resolveTripDuration,
  rollingMonthsFrom,
  salvageRecommendationsFromTruncatedJson,
  TRIP_RECOMMEND_MAX_OUTPUT_TOKENS,
  TRIP_RECOMMEND_MONTH_BATCH_SIZE,
  type ProductSummary,
} from '@/lib/bong-marketing/trip-recommender'

describe('extractThemes', () => {
  it('comma-separated themeTags', () => {
    expect(extractThemes('허니문,오션뷰', null)).toEqual(['허니문', '오션뷰'])
  })

  it('JSON array themeTags + themeLabelsRaw', () => {
    expect(extractThemes('["휴양","가족"]', '골프, 힐링')).toEqual(['휴양', '가족', '골프', '힐링'])
  })
})

describe('groupCitiesByCountry', () => {
  it('groups unique cities per country', () => {
    const products: ProductSummary[] = [
      { id: '1', title: 'A', country: 'japan', city: 'tokyo', continent: null, displayCategory: null, themes: [], tripNights: null, tripDays: null },
      { id: '2', title: 'B', country: 'japan', city: 'osaka', continent: null, displayCategory: null, themes: [], tripNights: null, tripDays: null },
      { id: '3', title: 'C', country: 'japan', city: 'tokyo', continent: null, displayCategory: null, themes: [], tripNights: null, tripDays: null },
    ]
    expect(groupCitiesByCountry(products)).toEqual({ japan: ['osaka', 'tokyo'] })
  })
})

describe('matchProductIds', () => {
  const products: ProductSummary[] = [
    { id: 'p1', title: '도쿄 4박', country: 'japan', city: 'tokyo', continent: null, displayCategory: null, themes: [], tripNights: 4, tripDays: 5 },
    { id: 'p2', title: '방콕 3박', country: 'thailand', city: 'bangkok', continent: null, displayCategory: null, themes: [], tripNights: 3, tripDays: 4 },
  ]

  it('matches by city slug', () => {
    const ids = matchProductIds({ city: 'tokyo', country: 'japan' }, products, {}, {})
    expect(ids).toEqual(['p1'])
  })

  it('matches by korean label', () => {
    const ids = matchProductIds({ city: '도쿄', country: '일본' }, products, { tokyo: '도쿄' }, { japan: '일본' })
    expect(ids).toEqual(['p1'])
  })
})

describe('resolveTripDuration', () => {
  const products: ProductSummary[] = [
    { id: 'p1', title: '도쿄 4박', country: 'japan', city: 'tokyo', continent: null, displayCategory: null, themes: [], tripNights: 4, tripDays: 5 },
  ]

  it('uses Gemini values when present', () => {
    expect(
      resolveTripDuration({ recommendedTripNights: 3, recommendedTripDays: 4 }, ['p1'], products),
    ).toEqual({ nights: 3, days: 4 })
  })

  it('falls back to matching product trip length', () => {
    expect(resolveTripDuration({}, ['p1'], products)).toEqual({ nights: 4, days: 5 })
  })
})

describe('month helpers', () => {
  it('rollingMonthsFrom starts at given month', () => {
    expect(rollingMonthsFrom(6, 12)).toEqual([6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5])
  })

  it('parseMonthNumber handles labels and ranges', () => {
    expect(parseMonthNumber(7)).toBe(7)
    expect(parseMonthNumber('7월')).toBe(7)
    expect(parseMonthNumber('10-11월')).toBe(10)
  })

  it('monthToSeason maps calendar months', () => {
    expect(monthToSeason(7)).toBe('summer')
    expect(monthToSeason(12)).toBe('winter')
  })

  it('isFutureRecommendationMonth allows 12-month window from next month', () => {
    // 6월 현재 → 허용: 7~12월 + 내년 1~6월 (내년 6월 포함)
    expect(isFutureRecommendationMonth(6, 6)).toBe(true)
    expect(isFutureRecommendationMonth(7, 6)).toBe(true)
    expect(isFutureRecommendationMonth(5, 6)).toBe(true)
    // 6월 현재 시 이번 달(출국 불가)은 Gemini 프롬프트에서 제외 — 파서는 창 안이면 허용
  })

  it('monthLabelFromNumber', () => {
    expect(monthLabelFromNumber(7)).toBe('7월')
  })
})

describe('TRIP_RECOMMEND token/batch constants', () => {
  it('uses 16384 output tokens', () => {
    expect(TRIP_RECOMMEND_MAX_OUTPUT_TOKENS).toBe(16384)
  })

  it('uses 4-month batches for 12-month window', () => {
    expect(TRIP_RECOMMEND_MONTH_BATCH_SIZE).toBe(4)
    const months = rollingMonthsFrom(7, 12)
    expect(Math.ceil(months.length / TRIP_RECOMMEND_MONTH_BATCH_SIZE)).toBe(3)
  })
})

describe('salvageRecommendationsFromTruncatedJson', () => {
  it('extracts complete recommendation objects from truncated JSON', () => {
    const truncated = `{
  "recommendations": [
    {
      "city": "도쿄",
      "country": "일본",
      "month": 7,
      "monthLabel": "7월",
      "urgency": "휴가",
      "reason": "여름 축제",
      "recommendedTripNights": 4,
      "recommendedTripDays": 5
    },
    {
      "city": "오사카",
      "country": "일본",
      "month": 7,
      "monthLabel": "7월",
      "reason": "잘린 문자열`

    const items = salvageRecommendationsFromTruncatedJson(truncated)
    expect(items).toHaveLength(1)
    expect((items[0] as { city: string }).city).toBe('도쿄')
  })
})

describe('parseTripRecommendationsFromGeminiRaw', () => {
  it('parses valid JSON', () => {
    const raw = JSON.stringify({
      recommendations: [{ city: '방콕', country: '태국', month: 8 }],
    })
    const result = parseTripRecommendationsFromGeminiRaw(raw)
    expect(result.partial).toBe(false)
    expect(result.recommendations).toHaveLength(1)
  })

  it('salvages partial JSON when one complete object exists', () => {
    const truncated = `{
  "recommendations": [
    {"city":"다낭","country":"베트남","month":6,"reason":"불꽃축제"},
    {"city":"잘림","country":"베트남","month":7,"reason":"unterminated`
    const result = parseTripRecommendationsFromGeminiRaw(truncated)
    expect(result.partial).toBe(true)
    expect(result.recommendations).toHaveLength(1)
  })
})
