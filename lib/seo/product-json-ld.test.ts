import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ProductJsonLd from '@/app/components/seo/ProductJsonLd'
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

  // REGRESSION-FREEZE[product-jsonld-canonical-url]
  it('uses public productPath (slug) for Product.url instead of raw id', () => {
    const data = buildProductJsonLdData({
      productId: 'cuid-internal-id',
      productPath: '/products/pkg-hn-0042',
      name: 'Test trip',
      description: 'desc',
      imageUrl: null,
      offers: {
        lowPrice: 100000,
        highPrice: 100000,
        offerCount: 1,
        availability: 'InStock',
      },
    })
    expect(String(data?.url)).toContain('/products/pkg-hn-0042')
    expect(String(data?.url)).not.toContain('cuid-internal-id')
    const offers = data?.offers as Record<string, unknown>
    expect(String(offers.url)).toContain('/products/pkg-hn-0042')
  })

  it('상품명에 script 종료 태그가 있어도 JSON-LD 스크립트가 끊기지 않는다', () => {
    const html = renderToStaticMarkup(
      ProductJsonLd({
        productId: 'p1',
        name: '투어</script><x>',
        description: '설명',
        imageUrl: null,
        offers: {
          lowPrice: 100000,
          highPrice: 100000,
          offerCount: 1,
          availability: 'InStock',
        },
      }),
    )
    expect(html).not.toContain('</script><x>')
    expect(html).toContain('\\u003c/script>')
  })
})
