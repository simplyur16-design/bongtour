import { describe, expect, it } from 'vitest'
import {
  isSimilarItineraryCompareFitProduct,
  prismaWhereForSimilarItineraryCompareKind,
  productMatchesSimilarItineraryCompareKind,
  similarItineraryCompareDisclaimer,
} from '@/lib/similar-itinerary-compare-kind'

describe('similar-itinerary-compare-kind', () => {
  // REGRESSION-FREEZE[similar-itinerary-compare-kind-split]: fit- 슬러그·air_hotel 판정 — manifest
  it('treats fit- slug and air_hotel listing as FIT', () => {
    expect(isSimilarItineraryCompareFitProduct({ slug: 'fit-danang-3n5d' })).toBe(true)
    expect(
      isSimilarItineraryCompareFitProduct({
        listingKind: 'air_hotel_free',
        productType: 'travel',
      }),
    ).toBe(true)
    expect(
      isSimilarItineraryCompareFitProduct({
        listingKind: 'travel',
        productType: 'air-hotel',
      }),
    ).toBe(true)
    expect(
      isSimilarItineraryCompareFitProduct({
        listingKind: 'travel',
        productType: 'travel',
        slug: 'pkg-shanghai-3n4d',
      }),
    ).toBe(false)
    // fim-* 는 패키지 (재분류 없음)
    expect(
      isSimilarItineraryCompareFitProduct({
        listingKind: 'travel',
        productType: 'travel',
        slug: 'fim-something-001',
      }),
    ).toBe(false)
  })

  it('memory filter keeps package and FIT disjoint', () => {
    const pkg = { listingKind: 'travel', productType: 'travel', slug: 'pkg-osaka' }
    const fit = { listingKind: 'air_hotel_free', productType: 'air-hotel', slug: 'fit-osaka' }
    const fitSlugOnly = { listingKind: 'travel', productType: 'travel', slug: 'fit-osaka-legacy' }
    expect(productMatchesSimilarItineraryCompareKind(pkg, 'package')).toBe(true)
    expect(productMatchesSimilarItineraryCompareKind(pkg, 'fit')).toBe(false)
    expect(productMatchesSimilarItineraryCompareKind(fit, 'fit')).toBe(true)
    expect(productMatchesSimilarItineraryCompareKind(fit, 'package')).toBe(false)
    expect(productMatchesSimilarItineraryCompareKind(fitSlugOnly, 'fit')).toBe(true)
    expect(productMatchesSimilarItineraryCompareKind(fitSlugOnly, 'package')).toBe(false)
  })

  // REGRESSION-FREEZE[similar-itinerary-compare-kind-split]: DB where kind push-down — manifest
  it('prisma where push-down excludes opposite kind', () => {
    const fitWhere = prismaWhereForSimilarItineraryCompareKind('fit')
    const pkgWhere = prismaWhereForSimilarItineraryCompareKind('package')
    expect(fitWhere).toEqual(
      expect.objectContaining({
        OR: expect.arrayContaining([
          { listingKind: 'air_hotel_free' },
          { slug: { startsWith: 'fit-' } },
        ]),
      }),
    )
    expect(pkgWhere).toEqual(
      expect.objectContaining({
        NOT: expect.objectContaining({
          OR: expect.arrayContaining([
            { listingKind: 'air_hotel_free' },
            { slug: { startsWith: 'fit-' } },
          ]),
        }),
      }),
    )
  })

  it('disclaimer names package vs FIT slice', () => {
    expect(similarItineraryCompareDisclaimer('package')).toContain('해외 패키지')
    expect(similarItineraryCompareDisclaimer('fit')).toContain('자유여행')
    expect(similarItineraryCompareDisclaimer('package')).toContain('섞지 않습니다')
  })
})
