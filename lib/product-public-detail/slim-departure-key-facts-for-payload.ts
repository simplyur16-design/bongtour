import type { DepartureKeyFacts, DepartureLegCard } from '@/lib/departure-key-facts'
import type { TravelProduct } from '@/app/components/travel/TravelProductDetail'

/** DTO 저장용 — 출발 키팩트 상한(메모리 #4 캐시·전송 균형) */
export const PAYLOAD_DEPARTURE_KEY_FACTS_MAX_ENTRIES = 30

function slimLegCard(leg: DepartureLegCard | null): DepartureLegCard | null {
  if (!leg) return null
  return {
    departureAirport: leg.departureAirport,
    departureAtText: leg.departureAtText,
    arrivalAirport: leg.arrivalAirport,
    arrivalAtText: leg.arrivalAtText,
    flightNo: leg.flightNo,
    flightDurationText: leg.flightDurationText ?? null,
  }
}

export function slimDepartureKeyFactsForPayload(facts: DepartureKeyFacts): DepartureKeyFacts {
  return {
    airline: facts.airline,
    outboundSummary: facts.outboundSummary,
    inboundSummary: facts.inboundSummary,
    meetingSummary: facts.meetingSummary,
    outbound: slimLegCard(facts.outbound),
    inbound: slimLegCard(facts.inbound),
  }
}

export function slimDepartureKeyFactsRecordForPayload(
  facts: Record<string, DepartureKeyFacts> | undefined | null,
): Record<string, DepartureKeyFacts> | undefined {
  if (!facts || Object.keys(facts).length === 0) return undefined
  const sorted = Object.entries(facts).sort(([a], [b]) => a.localeCompare(b))
  const capped = sorted.slice(0, PAYLOAD_DEPARTURE_KEY_FACTS_MAX_ENTRIES)
  return Object.fromEntries(capped.map(([k, v]) => [k, slimDepartureKeyFactsForPayload(v)]))
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
