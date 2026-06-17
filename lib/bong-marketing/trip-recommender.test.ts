import { describe, it, expect } from 'vitest'
import {
  extractThemes,
  groupCitiesByCountry,
  matchProductIds,
  resolveTripDuration,
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
