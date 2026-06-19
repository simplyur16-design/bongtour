import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {},
}))

import {
  finalizeProductPublicDetailPayloadJson,
  PRODUCT_PUBLIC_DETAIL_PAYLOAD_MAX_BYTES,
} from '@/lib/product-public-detail/build-product-public-detail-payload'
import { bookableMinDateYmdForPayload } from '@/lib/product-public-detail/payload-io'
import { PRODUCT_PUBLIC_DETAIL_PAYLOAD_VERSION } from '@/lib/product-public-detail/types'
import type { ProductPublicDetailPackageRenderModel } from '@/lib/product-public-detail/types'
import {
  buildProductDetailSlimSelect,
  isProductDetailSlimRow,
} from '@/lib/product-detail-page-include'
import {
  productDetailPayloadByteLength,
  productDetailPayloadDtoHit,
} from '@/lib/product-detail-payload-hit'

function minimalPackageModel(): ProductPublicDetailPackageRenderModel {
  return {
    variant: 'package',
    viewProduct: {
      id: 'p1',
      title: 't',
      destination: 'd',
      duration: '3박4일',
      airline: 'a',
      prices: [],
      schedule: [],
    } as ProductPublicDetailPackageRenderModel['viewProduct'],
    ybtourDetailProduct: null,
    publicConsumptionModuleKey: 'modetour',
    isPackageItineraryBody: true,
    isPrivateOrSemi: false,
    showEsimCrossSell: false,
    resolvedPriceFrom: 1,
    seo: {
      coverUrl: null,
      productDescription: 'd',
      offers: null,
      breadcrumbItems: [],
      itinerary: null,
    },
    registrationStatus: 'registered',
    departuresForSeo: [],
  }
}

describe('productDetailPayloadDtoHit', () => {
  it('returns true when envelope bookable ymd matches', () => {
    const ymd = bookableMinDateYmdForPayload()
    const json = finalizeProductPublicDetailPayloadJson(minimalPackageModel(), ymd)
    expect(json).not.toBeNull()
    expect(productDetailPayloadDtoHit(json)).toBe(true)
  })

  it('returns false for stale bookable ymd', () => {
    const json = finalizeProductPublicDetailPayloadJson(minimalPackageModel(), '2000-01-01')
    expect(productDetailPayloadDtoHit(json)).toBe(false)
  })
})

describe('buildProductDetailSlimSelect', () => {
  it('excludes rawMeta schedule departures relations', () => {
    const keys = Object.keys(buildProductDetailSlimSelect())
    expect(keys).toContain('publicDetailPayloadJson')
    expect(keys).not.toContain('rawMeta')
    expect(keys).not.toContain('schedule')
    expect(keys).not.toContain('departures')
    expect(keys).not.toContain('prices')
  })
})

describe('isProductDetailSlimRow', () => {
  it('distinguishes slim from full-shaped row', () => {
    const slim = {
      id: 'x',
      registrationStatus: 'registered',
      productType: 'package',
      slug: 'pkg-1',
      publicDetailPayloadJson: '{}',
      publicDetailPayloadBuiltAt: new Date(),
    }
    const full = { ...slim, rawMeta: '{}', departures: [] }
    expect(isProductDetailSlimRow(slim)).toBe(true)
    expect(isProductDetailSlimRow(full)).toBe(false)
  })
})

describe('productDetailPayloadByteLength', () => {
  it('matches utf-8 byte length', () => {
    const s = '한글test'
    expect(productDetailPayloadByteLength(s)).toBe(Buffer.byteLength(s, 'utf8'))
    expect(productDetailPayloadByteLength(s)).toBeLessThan(PRODUCT_PUBLIC_DETAIL_PAYLOAD_MAX_BYTES)
  })
})
