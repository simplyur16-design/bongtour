/**
 * 등록 confirm — 출발 공항·지방출발 태그 저장 SSOT.
 * REGRESSION-FREEZE[product-departure-airport-label]
 */
import {
  LOCAL_DEPARTURE_TAG_VALUES,
  type LocalDepartureTag,
} from '@/lib/product-listing-kind'
import {
  inferDepartureAirportFromHaystack,
  inferDepartureAirportFromRegisterFactFlights,
  homeDepartureAirportDisplayText,
  type HomeDepartureAirportLabel,
} from '@/lib/infer-home-departure-airport'
import type { RegisterFactFlightLeg } from '@/lib/register-facts/types'

export function buildRegisterFlightInferHaystack(parts: {
  airline?: string | null
  scheduleText?: string | null
  includedText?: string | null
  flightSummary?: string | null
}): string {
  return [parts.airline, parts.flightSummary, parts.includedText, parts.scheduleText]
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean)
    .join('\n')
}

export function scheduleRowsToInferHaystack(
  schedule: ReadonlyArray<{
    title?: string | null
    description?: string | null
    routeText?: string | null
  }> | null | undefined,
): string {
  if (!schedule?.length) return ''
  return schedule
    .map((d) => [d.title, d.description, d.routeText].filter(Boolean).join(' '))
    .join('\n')
}

export function parseRegisterFactFlightsFromAdminBody(
  body: Record<string, unknown>,
): RegisterFactFlightLeg[] {
  const raw = body.registerFactFlights
  if (!Array.isArray(raw)) return []
  const legs: RegisterFactFlightLeg[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const directionRaw = typeof o.direction === 'string' ? o.direction.trim() : 'unknown'
    const direction: RegisterFactFlightLeg['direction'] =
      directionRaw === 'outbound' || directionRaw === 'inbound' ? directionRaw : 'unknown'
    legs.push({
      direction,
      carrier: typeof o.carrier === 'string' ? o.carrier.trim() || null : null,
      flightNo: typeof o.flightNo === 'string' ? o.flightNo.trim() || null : null,
      departureCity: typeof o.departureCity === 'string' ? o.departureCity.trim() || null : null,
      departureAt: typeof o.departureAt === 'string' ? o.departureAt.trim() || null : null,
      arrivalCity: typeof o.arrivalCity === 'string' ? o.arrivalCity.trim() || null : null,
      arrivalAt: typeof o.arrivalAt === 'string' ? o.arrivalAt.trim() || null : null,
    })
  }
  return legs
}

export function resolveRegisterProductDepartureAirportFields(args: {
  manualLocalDepartureTags: LocalDepartureTag[]
  inferHaystack: string
  factFlights?: RegisterFactFlightLeg[]
}): {
  localDepartureTag: LocalDepartureTag[]
  departureAirportLabel: HomeDepartureAirportLabel | null
} {
  const manual = args.manualLocalDepartureTags.filter((t) =>
    (LOCAL_DEPARTURE_TAG_VALUES as readonly string[]).includes(t),
  )
  const fromFacts = args.factFlights?.length
    ? inferDepartureAirportFromRegisterFactFlights(args.factFlights)
    : null
  const fromHaystack = inferDepartureAirportFromHaystack(args.inferHaystack)
  const inferred = fromFacts ?? fromHaystack

  return {
    localDepartureTag: manual.length > 0 ? manual : inferred.localDepartureTags,
    departureAirportLabel: inferred.airportLabel,
  }
}

export function departureAirportLabelDisplayText(
  label: string | null | undefined,
): string | null {
  return homeDepartureAirportDisplayText(label)
}
