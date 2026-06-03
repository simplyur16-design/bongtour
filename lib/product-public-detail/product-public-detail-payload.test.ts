import { describe, expect, it } from 'vitest'
import type { TravelProduct } from '@/app/components/travel/TravelProductDetail'
import type { DepartureKeyFacts } from '@/lib/departure-key-facts'
import {
  assertProductPublicDetailPayloadJson,
  finalizeProductPublicDetailPayloadJson,
  productPublicDetailPayloadByteLength,
  PRODUCT_PUBLIC_DETAIL_PAYLOAD_MAX_BYTES,
} from '@/lib/product-public-detail/build-product-public-detail-payload'
import {
  normalizeDepartureKeyFactsForPayload,
  PAYLOAD_KEY_FACTS_LIMIT,
  truncatePayloadKeyFactsString,
} from '@/lib/product-public-detail/normalize-departure-key-facts-for-payload'
import { prepareModelForPayloadPersistence } from '@/lib/product-public-detail/prepare-model-for-payload'
import {
  PAYLOAD_DEPARTURE_KEY_FACTS_MAX_ENTRIES,
  slimDepartureKeyFactsRecordForPayload,
} from '@/lib/product-public-detail/slim-departure-key-facts-for-payload'
import { stripPayloadLeakFieldsFromTravelProduct } from '@/lib/product-public-detail/strip-payload-leak-fields'
import {
  PRODUCT_PUBLIC_DETAIL_PAYLOAD_VERSION,
  type ProductPublicDetailPackageRenderModel,
} from '@/lib/product-public-detail/types'

const GENERAL_PACKAGE_PAYLOAD_MAX = 200 * 1024
const LARGE_PACKAGE_PAYLOAD_MAX = 500 * 1024

function makeKeyFacts(i: number): DepartureKeyFacts {
  const pad = `DEP-${String(i).padStart(3, '0')}-`.repeat(8)
  return {
    airline: '대한항공',
    outboundSummary: `${pad} outbound summary`,
    inboundSummary: `${pad} inbound summary`,
    meetingSummary: '인천 T1 07:00',
    outbound: {
      departureAirport: 'ICN',
      departureAtText: '2026.07.01(수) 10:00',
      arrivalAirport: 'NRT',
      arrivalAtText: '2026.07.01(수) 12:30',
      flightNo: `KE${1000 + i}`,
      flightDurationText: '비행소요시간 2시간 30분',
    },
    inbound: {
      departureAirport: 'NRT',
      departureAtText: '2026.07.08(수) 14:00',
      arrivalAirport: 'ICN',
      arrivalAtText: '2026.07.08(수) 16:30',
      flightNo: `KE${2000 + i}`,
      flightDurationText: '비행소요시간 2시간 20분',
    },
  }
}

function makeManyDeparturesFacts(count: number): Record<string, DepartureKeyFacts> {
  const out: Record<string, DepartureKeyFacts> = {}
  for (let i = 0; i < count; i++) {
    const ymd = `2026-${String(7 + Math.floor(i / 28)).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`
    out[ymd] = makeKeyFacts(i)
  }
  return out
}

function baseTravelProduct(overrides: Partial<TravelProduct> = {}): TravelProduct {
  return {
    id: 'prod-test-1',
    title: '테스트 패키지',
    destination: '도쿄',
    duration: '5박6일',
    airline: '대한항공',
    prices: [],
    schedule: [{ day: 1, title: '출발', description: '일정 설명', imageUrl: 'https://example.com/a.webp' }],
    publicDetailPayloadJson: '{"nested":"old-payload"}' as unknown as string,
    publicDetailPayloadBuiltAt: new Date().toISOString() as unknown as string,
    departureKeyFactsByDate: makeManyDeparturesFacts(100),
    ...overrides,
  } as TravelProduct
}

function packageModel(viewProduct: TravelProduct): ProductPublicDetailPackageRenderModel {
  return {
    variant: 'package',
    viewProduct,
    ybtourDetailProduct: null,
    publicConsumptionModuleKey: 'hanatour',
    isPackageItineraryBody: true,
    isPrivateOrSemi: false,
    showEsimCrossSell: true,
    resolvedPriceFrom: 1_200_000,
    seo: {
      coverUrl: 'https://example.com/cover.webp',
      productDescription: 'desc',
      offers: null,
      breadcrumbItems: [{ position: 1, name: '홈' }],
      itinerary: null,
    },
    registrationStatus: 'registered',
    departuresForSeo: [],
  }
}

describe('product public detail payload SSOT', () => {
  it('strips publicDetailPayloadJson from travel product before persist', () => {
    const stripped = stripPayloadLeakFieldsFromTravelProduct(baseTravelProduct())
    expect(stripped).not.toHaveProperty('publicDetailPayloadJson')
    expect(stripped).not.toHaveProperty('publicDetailPayloadBuiltAt')
  })

  it('caps departureKeyFactsByDate to 30 entries for payload', () => {
    const slimmed = slimDepartureKeyFactsRecordForPayload(makeManyDeparturesFacts(100))
    expect(slimmed).toBeDefined()
    expect(Object.keys(slimmed!)).toHaveLength(PAYLOAD_DEPARTURE_KEY_FACTS_MAX_ENTRIES)
  })

  it('serialized JSON has zero publicDetailPayloadJson self-reference', () => {
    const json = finalizeProductPublicDetailPayloadJson(packageModel(baseTravelProduct()))
    expect(json).not.toBeNull()
    expect(/publicDetailPayloadJson/i.test(json!)).toBe(false)
    expect(json!.includes('nested')).toBe(false)
  })

  it('100-departure fixture payload stays under 500 KB (utf-8 bytes)', () => {
    const json = finalizeProductPublicDetailPayloadJson(packageModel(baseTravelProduct()))
    expect(json).not.toBeNull()
    expect(productPublicDetailPayloadByteLength(json!)).toBeLessThan(LARGE_PACKAGE_PAYLOAD_MAX)
  })

  it('general package fixture stays under 200 KB (utf-8 bytes)', () => {
    const json = finalizeProductPublicDetailPayloadJson(
      packageModel(
        baseTravelProduct({
          departureKeyFactsByDate: makeManyDeparturesFacts(12),
          schedule: [{ day: 1, title: '1일차', description: '짧은 일정' }],
        }),
      ),
    )
    expect(json).not.toBeNull()
    expect(productPublicDetailPayloadByteLength(json!)).toBeLessThan(GENERAL_PACKAGE_PAYLOAD_MAX)
  })

  it('truncates jam arrivalAirport over 200 chars', () => {
    const jam = '인천 2026.07.10(금) 08:40 7C2624 '.repeat(400)
    const normalized = normalizeDepartureKeyFactsForPayload({
      airline: '제주항공',
      outboundSummary: null,
      inboundSummary: jam,
      meetingSummary: null,
      outbound: null,
      inbound: {
        departureAirport: 'ICN',
        departureAtText: '2026.07.10(금) 08:40',
        arrivalAirport: jam,
        arrivalAtText: '2026.07.10(금) 12:00',
        flightNo: '7C2624',
        flightDurationText: null,
      },
    })
    expect(normalized.inbound?.arrivalAirport?.length ?? 0).toBeLessThanOrEqual(
      PAYLOAD_KEY_FACTS_LIMIT.arrivalAirport,
    )
    expect(normalized.inboundSummary?.length ?? 0).toBeLessThanOrEqual(PAYLOAD_KEY_FACTS_LIMIT.inboundSummary)
  })

  it('30 departures × 26KB jam per date stays under 1 MB utf-8', () => {
    const jam = '상품가격 1,249,900원 스페셜 혜택 '.repeat(900)
    const byDate: Record<string, DepartureKeyFacts> = {}
    for (let i = 0; i < 30; i++) {
      const ymd = `2026-07-${String((i % 28) + 1).padStart(2, '0')}`
      byDate[ymd] = {
        airline: '제주항공',
        outboundSummary: jam,
        inboundSummary: jam,
        meetingSummary: null,
        outbound: {
          departureAirport: jam,
          departureAtText: null,
          arrivalAirport: jam,
          arrivalAtText: null,
          flightNo: '7C2624',
          flightDurationText: null,
        },
        inbound: {
          departureAirport: jam,
          departureAtText: null,
          arrivalAirport: jam,
          arrivalAtText: null,
          flightNo: '7C2625',
          flightDurationText: null,
        },
      }
    }
    const json = finalizeProductPublicDetailPayloadJson(
      packageModel(baseTravelProduct({ departureKeyFactsByDate: byDate })),
    )
    expect(json).not.toBeNull()
    expect(productPublicDetailPayloadByteLength(json!)).toBeLessThan(PRODUCT_PUBLIC_DETAIL_PAYLOAD_MAX_BYTES)
  })

  it('runtime assertion rejects self-reference in raw JSON', () => {
    expect(() =>
      assertProductPublicDetailPayloadJson('{"model":{"publicDetailPayloadJson":"x"}}'),
    ).toThrow(/self-reference/i)
  })

  it('runtime assertion rejects payloads over 1 MB utf-8 bytes', () => {
    const over = 'x'.repeat(PRODUCT_PUBLIC_DETAIL_PAYLOAD_MAX_BYTES + 1)
    expect(productPublicDetailPayloadByteLength(over)).toBeGreaterThan(
      PRODUCT_PUBLIC_DETAIL_PAYLOAD_MAX_BYTES,
    )
    expect(() => assertProductPublicDetailPayloadJson(over)).toThrow(/bytes exceeds/i)
  })

  it('truncatePayloadKeyFactsString enforces max length', () => {
    expect(truncatePayloadKeyFactsString('a'.repeat(1000), 200, 'test')?.length).toBe(200)
  })

  it('prepareModelForPayloadPersistence does not duplicate serialized key', () => {
    const prepared = prepareModelForPayloadPersistence(packageModel(baseTravelProduct()))
    expect(prepared.variant).toBe('package')
    if (prepared.variant === 'package') {
      expect(prepared).not.toHaveProperty('serialized')
      expect(prepared.viewProduct).toBeDefined()
    }
    const json = JSON.stringify({
      version: PRODUCT_PUBLIC_DETAIL_PAYLOAD_VERSION,
      model: prepared,
    })
    expect(json.includes('"serialized"')).toBe(false)
  })
})
