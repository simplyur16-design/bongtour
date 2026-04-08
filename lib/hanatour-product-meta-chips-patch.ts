/**
 * 하나투어 전용: `buildProductMetaChips` 결과의 flightRouting 칩만 교체.
 */
import type { DepartureKeyFacts } from '@/lib/departure-key-facts'
import type { FlightRoutingProductInput } from '@/lib/flight-routing-meta'
import type { FlightStructuredBody } from '@/lib/public-product-extras'
import type { ProductMetaChip } from '@/lib/product-meta-chips'
import { inferHanatourFlightRoutingMeta } from '@/lib/hanatour-flight-routing-meta'

export function applyHanatourFlightRoutingChipOverride(
  chips: ProductMetaChip[],
  args: {
    title?: string | null
    duration?: string | null
    includedText?: string | null
    excludedText?: string | null
    flightStructured?: FlightStructuredBody | null
    departureKeyFactsByDate?: Record<string, DepartureKeyFacts> | null
    departureFactsOverride?: DepartureKeyFacts | null
  }
): ProductMetaChip[] {
  const input: FlightRoutingProductInput & { duration?: string | null } = {
    title: args.title,
    duration: args.duration,
    includedText: args.includedText,
    excludedText: args.excludedText,
    flightStructured: args.flightStructured ?? null,
    departureKeyFactsByDate: args.departureKeyFactsByDate ?? null,
    departureFactsOverride: args.departureFactsOverride ?? null,
  }
  const routing = inferHanatourFlightRoutingMeta(input)
  const idx = chips.findIndex((c) => c.kind === 'flightRouting')
  if (idx < 0) return chips
  const next = [...chips]
  next[idx] = { ...next[idx]!, value: routing.flightRoutingLabel }
  return next
}
