/**
 * registered 상품 — 저장된 항공·일정·rawMeta에서 출발공항·지방출발 태그 backfill SSOT.
 * REGRESSION-FREEZE[product-departure-airport-label]
 */
import type { FlightStructured } from '@/lib/detail-body-parser-types'
import {
  LOCAL_DEPARTURE_TAG_VALUES,
  type LocalDepartureTag,
} from '@/lib/product-listing-kind'
import type { RegisterFactFlightLeg } from '@/lib/register-facts/types'
import {
  buildRegisterFlightInferHaystack,
  resolveRegisterProductDepartureAirportFields,
  scheduleRowsToInferHaystack,
} from '@/lib/register-product-departure-airport-save'
import type { HomeDepartureAirportLabel } from '@/lib/infer-home-departure-airport'

export type StoredProductDepartureAirportInput = {
  airline: string | null
  includedText: string | null
  scheduleJson: string | null
  itineraryHaystack: string | null
  rawMeta: string | null
  existingLocalDepartureTags: LocalDepartureTag[]
}

function parseRawMetaStructuredSignals(rawMeta: string | null): Record<string, unknown> | null {
  if (!rawMeta?.trim()) return null
  try {
    const meta = JSON.parse(rawMeta) as unknown
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null
    const sig = (meta as Record<string, unknown>).structuredSignals
    if (!sig || typeof sig !== 'object' || Array.isArray(sig)) return null
    return sig as Record<string, unknown>
  } catch {
    return null
  }
}

function flightStructuredFromRawMeta(rawMeta: string | null): FlightStructured | null {
  const sig = parseRawMetaStructuredSignals(rawMeta)
  const fs = sig?.flightStructured
  if (!fs || typeof fs !== 'object' || Array.isArray(fs)) return null
  return fs as FlightStructured
}

export function flightStructuredToRegisterFactLegs(
  fs: FlightStructured | null | undefined,
): RegisterFactFlightLeg[] {
  if (!fs) return []
  const carrier = fs.airlineName?.trim() || null
  const legs: RegisterFactFlightLeg[] = []

  const out = fs.outbound
  if (out?.departureAirport?.trim() || out?.flightNo?.trim() || out?.arrivalAirport?.trim()) {
    legs.push({
      direction: 'outbound',
      carrier,
      flightNo: out.flightNo?.trim() || null,
      departureCity: out.departureAirport?.trim() || null,
      departureAt: out.departureDate?.trim() || null,
      arrivalCity: out.arrivalAirport?.trim() || null,
      arrivalAt: out.arrivalDate?.trim() || null,
    })
  }

  const inn = fs.inbound
  if (inn?.departureAirport?.trim() || inn?.flightNo?.trim() || inn?.arrivalAirport?.trim()) {
    legs.push({
      direction: 'inbound',
      carrier,
      flightNo: inn.flightNo?.trim() || null,
      departureCity: inn.departureAirport?.trim() || null,
      departureAt: inn.departureDate?.trim() || null,
      arrivalCity: inn.arrivalAirport?.trim() || null,
      arrivalAt: inn.arrivalDate?.trim() || null,
    })
  }

  return legs
}

export function scheduleJsonToInferHaystack(scheduleJson: string | null): string {
  if (!scheduleJson?.trim()) return ''
  try {
    const arr = JSON.parse(scheduleJson) as unknown
    if (!Array.isArray(arr)) return ''
    const rows = arr
      .map((row) => {
        if (!row || typeof row !== 'object') return null
        const o = row as Record<string, unknown>
        return {
          title: typeof o.title === 'string' ? o.title : null,
          description: typeof o.description === 'string' ? o.description : null,
          routeText: typeof o.routeText === 'string' ? o.routeText : null,
        }
      })
      .filter(Boolean) as Array<{ title?: string | null; description?: string | null; routeText?: string | null }>
    return scheduleRowsToInferHaystack(rows)
  } catch {
    return ''
  }
}

export function itineraryDaysToInferHaystack(
  days: ReadonlyArray<{
    city?: string | null
    summaryTextRaw?: string | null
    transport?: string | null
    rawBlock?: string | null
  }>,
): string {
  if (!days.length) return ''
  return days
    .map((d) => [d.city, d.summaryTextRaw, d.transport, d.rawBlock].filter(Boolean).join(' '))
    .join('\n')
}

export function inferDepartureAirportFieldsFromStoredProduct(input: StoredProductDepartureAirportInput): {
  localDepartureTag: LocalDepartureTag[]
  departureAirportLabel: HomeDepartureAirportLabel | null
} {
  const sig = parseRawMetaStructuredSignals(input.rawMeta)
  const flightSummary = [sig?.departureSegmentText, sig?.returnSegmentText]
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean)
    .join('\n')

  const scheduleText = [
    scheduleJsonToInferHaystack(input.scheduleJson),
    input.itineraryHaystack ?? '',
  ]
    .filter(Boolean)
    .join('\n')

  const factFlights = flightStructuredToRegisterFactLegs(flightStructuredFromRawMeta(input.rawMeta))

  return resolveRegisterProductDepartureAirportFields({
    manualLocalDepartureTags: input.existingLocalDepartureTags.filter((t) =>
      (LOCAL_DEPARTURE_TAG_VALUES as readonly string[]).includes(t),
    ),
    inferHaystack: buildRegisterFlightInferHaystack({
      airline: input.airline,
      includedText: input.includedText,
      scheduleText: scheduleText || null,
      flightSummary: flightSummary || null,
    }),
    factFlights: factFlights.length > 0 ? factFlights : undefined,
  })
}

export function shouldUpdateStoredDepartureAirportFields(args: {
  currentLabel: string | null
  currentTags: readonly string[]
  inferred: { localDepartureTag: LocalDepartureTag[]; departureAirportLabel: HomeDepartureAirportLabel | null }
  onlyFillMissing: boolean
}): boolean {
  const nextLabel = args.inferred.departureAirportLabel ?? null
  const nextTags = [...args.inferred.localDepartureTag].sort()
  const curTags = [...args.currentTags].sort()

  if (args.onlyFillMissing) {
    const labelMissing = !args.currentLabel?.trim() && nextLabel != null
    const tagsMissing = curTags.length === 0 && nextTags.length > 0
    return labelMissing || tagsMissing
  }

  return (args.currentLabel ?? null) !== nextLabel || JSON.stringify(curTags) !== JSON.stringify(nextTags)
}
