import { describe, expect, it } from 'vitest'
import {
  SIMILAR_ITINERARY_COMPARE_PATH,
  buildSimilarItineraryCompareHref,
  buildSimilarItineraryCompareHrefFromProduct,
  similarItineraryComparePlaceFromProduct,
} from '@/lib/similar-itinerary-compare-href'

function hrefParams(href: string | null): URLSearchParams {
  expect(href).toBeTruthy()
  return new URL(href!, 'https://example.test').searchParams
}

describe('similar-itinerary-compare-href', () => {
  it('builds query href for place+duration', () => {
    const href = buildSimilarItineraryCompareHref({ place: '방콕', duration: '3박 5일' })
    expect(href?.startsWith(`${SIMILAR_ITINERARY_COMPARE_PATH}?`)).toBe(true)
    const qs = hrefParams(href)
    expect(qs.get('place')).toBe('방콕')
    expect(qs.get('duration')).toBe('3박 5일')
  })

  it('returns null when place or duration missing', () => {
    expect(buildSimilarItineraryCompareHref({ place: '', duration: '3박 5일' })).toBeNull()
    expect(buildSimilarItineraryCompareHref({ place: '방콕', duration: '' })).toBeNull()
  })

  it('takes first place token after KR departure scrub', () => {
    expect(
      similarItineraryComparePlaceFromProduct({
        primaryDestination: '부산 · 마츠야마',
        destination: null,
      }),
    ).toBe('마츠야마')
  })

  it('builds from product fields matching compare loader keys', () => {
    const href = buildSimilarItineraryCompareHrefFromProduct({
      primaryDestination: '상해',
      destination: '중국',
      duration: '3박  4일',
    })
    const qs = hrefParams(href)
    expect(qs.get('place')).toBe('상해')
    expect(qs.get('duration')).toBe('3박 4일')
  })

  it('falls back duration from title when DB duration empty', () => {
    const href = buildSimilarItineraryCompareHrefFromProduct({
      primaryDestination: '방콕',
      duration: null,
      title: '방콕 시티 3박5일',
    })
    const qs = hrefParams(href)
    expect(qs.get('place')).toBe('방콕')
    expect(qs.get('duration')).toBe('3박 5일')
  })
})
