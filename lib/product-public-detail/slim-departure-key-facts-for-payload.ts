import type { DepartureKeyFacts } from '@/lib/departure-key-facts'
import type { TravelProduct } from '@/app/components/travel/TravelProductDetail'
import {
  normalizeDepartureKeyFactsForPayload,
  normalizeDepartureKeyFactsRecordForPayload,
} from '@/lib/product-public-detail/normalize-departure-key-facts-for-payload'

/** DTO 저장용 — 출발 키팩트 상한(메모리 #4 캐시·전송 균형) */
export const PAYLOAD_DEPARTURE_KEY_FACTS_MAX_ENTRIES = 30

export function slimDepartureKeyFactsForPayload(facts: DepartureKeyFacts): DepartureKeyFacts {
  return normalizeDepartureKeyFactsForPayload(facts)
}

export function slimDepartureKeyFactsRecordForPayload(
  facts: Record<string, DepartureKeyFacts> | undefined | null,
): Record<string, DepartureKeyFacts> | undefined {
  if (!facts || Object.keys(facts).length === 0) return undefined
  const sorted = Object.entries(facts).sort(([a], [b]) => a.localeCompare(b))
  const capped = sorted.slice(0, PAYLOAD_DEPARTURE_KEY_FACTS_MAX_ENTRIES)
  const normalized = normalizeDepartureKeyFactsRecordForPayload(
    Object.fromEntries(capped) as Record<string, DepartureKeyFacts>,
  )
  return normalized
}

export function slimTravelProductDepartureFactsForPayload(product: TravelProduct): TravelProduct {
  return {
    ...product,
    departureKeyFactsByDate: slimDepartureKeyFactsRecordForPayload(
      product.departureKeyFactsByDate ?? undefined,
    ),
    departureKeyFactsByDepartureId: slimDepartureKeyFactsRecordForPayload(
      product.departureKeyFactsByDepartureId ?? undefined,
    ),
  }
}
