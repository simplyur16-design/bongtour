import { describe, expect, it } from 'vitest'
import type { TravelProduct } from '@/app/components/travel/TravelProductDetail'
import {
  assertProductPublicDetailPayloadJson,
  finalizeProductPublicDetailPayloadJson,
  productPublicDetailPayloadByteLength,
  PRODUCT_PUBLIC_DETAIL_PAYLOAD_MAX_BYTES,
} from '@/lib/product-public-detail/build-product-public-detail-payload'
import { bookableMinDateYmdForPayload } from '@/lib/product-public-detail/payload-io'
import { prepareModelForPayloadPersistence } from '@/lib/product-public-detail/prepare-model-for-payload'
import {
  PRODUCT_PUBLIC_DETAIL_PAYLOAD_VERSION,
  type ProductPublicDetailPackageRenderModel,
} from '@/lib/product-public-detail/types'

function minimalPackageModel(): ProductPublicDetailPackageRenderModel {
  const viewProduct = {
    id: 'prod-reg-1',
    title: '신규 등록 테스트',
    destination: '싱가포르',
    duration: '3박4일',
    airline: '제주항공',
    prices: [],
    schedule: [{ day: 1, title: '1일차', description: '일정' }],
  } as TravelProduct
  return {
    variant: 'package',
    viewProduct,
    ybtourDetailProduct: null,
    publicConsumptionModuleKey: 'modetour',
    isPackageItineraryBody: true,
    isPrivateOrSemi: false,
    showEsimCrossSell: false,
    resolvedPriceFrom: 1_000_000,
    seo: {
      coverUrl: 'https://example.com/c.webp',
      productDescription: 'desc',
      offers: null,
      breadcrumbItems: [{ position: 1, name: '홈' }],
      itinerary: null,
    },
    registrationStatus: 'registered',
    departuresForSeo: [],
  }
}

describe('registration payload coverage (post-revalidate rebuild)', () => {
  it('finalize uses today+2 Seoul bookableMinDateYmd', () => {
    const expected = bookableMinDateYmdForPayload()
    const json = finalizeProductPublicDetailPayloadJson(minimalPackageModel())
    expect(json).not.toBeNull()
    const envelope = JSON.parse(json!) as { bookableMinDateYmd: string }
    expect(envelope.bookableMinDateYmd).toBe(expected)
  })

  it('built JSON stays under 1 MB utf-8 and has no self-reference', () => {
    const json = finalizeProductPublicDetailPayloadJson(minimalPackageModel())
    expect(json).not.toBeNull()
    expect(productPublicDetailPayloadByteLength(json!)).toBeLessThan(
      PRODUCT_PUBLIC_DETAIL_PAYLOAD_MAX_BYTES,
    )
    expect(() => assertProductPublicDetailPayloadJson(json!)).not.toThrow()
    expect(json!.includes('publicDetailPayloadJson')).toBe(false)
  })

  it('prepareModel strips serialized duplicate (dac1036)', () => {
    const prepared = prepareModelForPayloadPersistence(minimalPackageModel())
    expect(prepared.variant).toBe('package')
    if (prepared.variant === 'package') {
      expect(prepared).not.toHaveProperty('serialized')
    }
    const raw = JSON.stringify({
      version: PRODUCT_PUBLIC_DETAIL_PAYLOAD_VERSION,
      model: prepared,
    })
    expect(raw.includes('"serialized"')).toBe(false)
  })
})
