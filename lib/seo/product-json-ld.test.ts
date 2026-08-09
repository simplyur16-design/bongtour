import { describe, expect, it } from 'vitest'
import { buildProductJsonLdData } from '@/lib/seo/product-json-ld'

describe('buildProductJsonLdData', () => {
  // REGRESSION-FREEZE[product-jsonld-requires-offers]
  it('returns null when offers missing (Google Product rich result requirement)', () => {
    expect(
      buildProductJsonLdData({
        productId: 'p1',
        name: 'Test trip',
        description: 'desc',
        imageUrl: null,
        offers: null,
      }),
    ).toBeNull()
  })

  it('returns null when prices are not positive', () => {
    expect(
      buildProductJsonLdData({
        productId: 'p1',
        name: 'Test trip',
        description: 'desc',
        imageUrl: null,
        offers: {
          lowPrice: 0,
          highPrice: 0,
          offerCount: 1,
          availability: 'OutOfStock',
        },
      }),
    ).toBeNull()
  })

  it('emits AggregateOffer when offerCount >= 1', () => {
    const data = buildProductJsonLdData({
      productId: 'p1',
      name: 'Test trip',
      description: 'desc',
      imageUrl: null,
      offers: {
        lowPrice: 100000,
        highPrice: 200000,
        offerCount: 3,
        availability: 'InStock',
      },
    })
    expect(data).not.toBeNull()
    expect(data?.['@type']).toBe('Product')
    const offers = data?.offers as Record<string, unknown>
    expect(offers['@type']).toBe('AggregateOffer')
    expect(offers.offerCount).toBe(3)
    expect(offers.lowPrice).toBe(100000)
  })

  it('emits Offer (not AggregateOffer) when offerCount is 0', () => {
    const data = buildProductJsonLdData({
      productId: 'p1',
      name: 'Test trip',
      description: 'desc',
      imageUrl: null,
      offers: {
        lowPrice: 150000,
        highPrice: 150000,
        offerCount: 0,
        availability: 'OutOfStock',
      },
    })
    const offers = data?.offers as Record<string, unknown>
    expect(offers['@type']).toBe('Offer')
    expect(offers.price).toBe(150000)
    expect(offers).not.toHaveProperty('offerCount')
  })
})
