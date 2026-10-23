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
    expect(qs.get('kind')).toBe('package')
  })

  // REGRESSION-FREEZE[similar-itinerary-compare-kind-split]: FIT href kind=fit — manifest
  it('FIT product href uses kind=fit', () => {
    const qs = hrefParams(
      buildSimilarItineraryCompareHrefFromProduct({
        primaryDestination: '다낭',
        duration: '3박 5일',
        listingKind: 'air_hotel_free',
        productType: 'air-hotel',
      }),
    )
    expect(qs.get('kind')).toBe('fit')
  })

  it('returns null when place or duration missing', () => {
    expect(buildSimilarItineraryCompareHref({ place: '', duration: '3박 5일' })).toBeNull()
    expect(buildSimilarItineraryCompareHref({ place: '방콕', duration: '' })).toBeNull()
  })

  // REGRESSION-FREEZE[similar-itinerary-compare-entry]: place는 메가메뉴 leaf — manifest
  it('returns null for bare country (일본/중국) — no country-level compare', () => {
    expect(buildSimilarItineraryCompareHref({ place: '일본', duration: '3박 5일' })).toBeNull()
    expect(buildSimilarItineraryCompareHref({ place: '중국', duration: '3박 4일' })).toBeNull()
  })

  it('maps 칭다오 query to mega leaf 청도', () => {
    const qs = hrefParams(buildSimilarItineraryCompareHref({ place: '칭다오', duration: '3박4일' }))
    expect(qs.get('place')).toBe('청도')
    expect(qs.get('duration')).toBe('3박 4일')
  })

  it('takes mega leaf after KR departure scrub', () => {
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

  // REGRESSION-FREEZE[similar-itinerary-compare-entry]: duration은 compose·title 힌트만 — manifest
  it('normalizes duration via compose; ignores non-duration DB strings', () => {
    const href = buildSimilarItineraryCompareHrefFromProduct({
      primaryDestination: '상해',
      duration: '3박4일',
      totalDays: 4,
    })
    expect(hrefParams(href).get('duration')).toBe('3박 4일')
    expect(
      buildSimilarItineraryCompareHrefFromProduct({
        primaryDestination: '상해',
        duration: '여행안내',
        title: '상해 자유 2박3일',
      }),
    ).toBeTruthy()
    expect(
      hrefParams(
        buildSimilarItineraryCompareHrefFromProduct({
          primaryDestination: '상해',
          duration: '여행안내',
          title: '상해 자유 2박3일',
        }),
      ).get('duration'),
    ).toBe('2박 3일')
  })
})
