import type { DepartureKeyFacts, DepartureLegCard } from '@/lib/departure-key-facts'

/** DTO persist — 잘못 수집된 modetour 등 대용량 문자열 방어 */
export const PAYLOAD_KEY_FACTS_LIMIT = {
  arrivalAirport: 200,
  departureAirport: 200,
  flightNo: 20,
  arrivalAtText: 50,
  departureAtText: 50,
  flightDurationText: 50,
  outboundSummary: 200,
  inboundSummary: 200,
  meetingSummary: 200,
  airline: 80,
} as const

export function truncatePayloadKeyFactsString(
  value: string | null | undefined,
  maxLen: number,
  fieldLabel: string,
): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length <= maxLen) return trimmed
  console.warn(
    `[product-public-detail-payload] truncated ${fieldLabel}: ${trimmed.length} → ${maxLen} chars`,
  )
  return trimmed.slice(0, maxLen)
}

function normalizeLegForPayload(leg: DepartureLegCard | null, legLabel: string): DepartureLegCard | null {
  if (!leg) return null
  return {
    departureAirport: truncatePayloadKeyFactsString(
      leg.departureAirport,
      PAYLOAD_KEY_FACTS_LIMIT.departureAirport,
      `${legLabel}.departureAirport`,
    ),
    departureAtText: truncatePayloadKeyFactsString(
      leg.departureAtText,
      PAYLOAD_KEY_FACTS_LIMIT.departureAtText,
      `${legLabel}.departureAtText`,
    ),
    arrivalAirport: truncatePayloadKeyFactsString(
      leg.arrivalAirport,
      PAYLOAD_KEY_FACTS_LIMIT.arrivalAirport,
      `${legLabel}.arrivalAirport`,
    ),
    arrivalAtText: truncatePayloadKeyFactsString(
      leg.arrivalAtText,
      PAYLOAD_KEY_FACTS_LIMIT.arrivalAtText,
      `${legLabel}.arrivalAtText`,
    ),
    flightNo: truncatePayloadKeyFactsString(leg.flightNo, PAYLOAD_KEY_FACTS_LIMIT.flightNo, `${legLabel}.flightNo`),
    flightDurationText: truncatePayloadKeyFactsString(
      leg.flightDurationText,
      PAYLOAD_KEY_FACTS_LIMIT.flightDurationText,
      `${legLabel}.flightDurationText`,
    ),
  }
}

/**
 * inbound/outbound leg + summary 둘 다 UI·routing에서 쓰임 — 필드 제거 대신 문자열 상한만 적용.
 * 잡 데이터가 leg·summary에 중복돼도 각각 truncate 되어 byte 폭발 방지.
 */
export function normalizeDepartureKeyFactsForPayload(facts: DepartureKeyFacts): DepartureKeyFacts {
  return {
    airline: truncatePayloadKeyFactsString(facts.airline, PAYLOAD_KEY_FACTS_LIMIT.airline, 'airline'),
    outboundSummary: truncatePayloadKeyFactsString(
      facts.outboundSummary,
      PAYLOAD_KEY_FACTS_LIMIT.outboundSummary,
      'outboundSummary',
    ),
    inboundSummary: truncatePayloadKeyFactsString(
      facts.inboundSummary,
      PAYLOAD_KEY_FACTS_LIMIT.inboundSummary,
      'inboundSummary',
    ),
    meetingSummary: truncatePayloadKeyFactsString(
      facts.meetingSummary,
      PAYLOAD_KEY_FACTS_LIMIT.meetingSummary,
      'meetingSummary',
    ),
    outbound: normalizeLegForPayload(facts.outbound, 'outbound'),
    inbound: normalizeLegForPayload(facts.inbound, 'inbound'),
  }
}

export function normalizeDepartureKeyFactsRecordForPayload(
  facts: Record<string, DepartureKeyFacts> | undefined | null,
): Record<string, DepartureKeyFacts> | undefined {
  if (!facts || Object.keys(facts).length === 0) return undefined
  return Object.fromEntries(
    Object.entries(facts).map(([k, v]) => [k, normalizeDepartureKeyFactsForPayload(v)]),
  )
}
