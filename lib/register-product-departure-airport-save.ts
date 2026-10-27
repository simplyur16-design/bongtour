/**
 * 등록 confirm — 출발 공항·지방출발 태그 저장 SSOT.
 * REGRESSION-FREEZE[product-departure-airport-label]
 * REGRESSION-FREEZE[register-pending-local-departure-strong-signal]: facts ICN이어도 제목 강한 신호 폴백 — manifest
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
import {
  detectLocalDepartureFromExplicitSignals,
  type LocalDepartureDetectInput,
} from '@/lib/local-departure-detect'

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
  /** 명시 신호(원 제목·rawTitle·출발공항 필드) — 감지되면 haystack 추론보다 우선 */
  explicitSignals?: LocalDepartureDetectInput | null
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
  // 항공 leg에 지방 라벨이 없으면 제목·본문 강한 신호로 폴백 (ICN-only facts가 [부산] 제목을 가리지 않음)
  // REGRESSION-FREEZE[register-pending-local-departure-strong-signal]
  const airportLabel = fromFacts?.airportLabel ?? fromHaystack.airportLabel
  const weakInferredTags =
    fromFacts?.airportLabel != null
      ? fromFacts.localDepartureTags
      : fromHaystack.localDepartureTags
  // REGRESSION-FREEZE[local-departure-detect-explicit]: 명시 지방 도시가 있으면 그 결과만(태그 없는 도시 → [] + review) — manifest
  const explicit = args.explicitSignals ? detectLocalDepartureFromExplicitSignals(args.explicitSignals) : null
  const inferredTags: LocalDepartureTag[] =
    explicit && explicit.cities.length > 0 ? explicit.tags : weakInferredTags

  return {
    localDepartureTag: manual.length > 0 ? manual : inferredTags,
    departureAirportLabel: airportLabel,
  }
}

export function departureAirportLabelDisplayText(
  label: string | null | undefined,
): string | null {
  return homeDepartureAirportDisplayText(label)
}
