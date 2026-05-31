import type { ProductDeparture } from '@prisma/client'
import type { AdminFlightProfile, FlightDisplayPolicy } from '@/lib/admin-flight-profile'
import { buildKeyFactsFromAdminProfile } from '@/lib/admin-flight-profile'
import {
  buildDepartureKeyFactsByDepartureId,
  buildDepartureKeyFactsMap,
  enrichDepartureKeyFactsMapForDisplay,
  mergeAdminDepartureFactsWithParsedLegs,
  type DepartureKeyFacts,
} from '@/lib/departure-key-facts'
import {
  sanitizeKyowontourPublicDepartureKeyFacts,
} from '@/lib/kyowontour-product-public-display'
import {
  sanitizeLottetourPublicDepartureKeyFacts,
} from '@/lib/lottetour-product-public-display'
import {
  sanitizeModetourPublicDepartureKeyFacts,
} from '@/lib/modetour-product-public-display'
import type { FlightStructuredBody } from '@/lib/public-product-extras'

export type BuildProductDetailDepartureKeyFactsInput = {
  departures: readonly ProductDeparture[]
  flightStructured: FlightStructuredBody | null
  productAirline: string | null
  adminFlightProfile: AdminFlightProfile | null
  flightDisplayPolicy: FlightDisplayPolicy
  verygoodtourPublicRowFactsOnly: boolean
  useModetourDirectedParse: boolean
  useKyowontourPublicFlightScrub: boolean
  useLottetourPublicFlightScrub: boolean
}

export function buildProductDetailDepartureKeyFacts(
  input: BuildProductDetailDepartureKeyFactsInput
): {
  departureKeyFactsByDate: Record<string, DepartureKeyFacts> | undefined
  departureKeyFactsByDepartureId: Record<string, DepartureKeyFacts> | undefined
} {
  const {
    departures,
    flightStructured,
    productAirline,
    adminFlightProfile,
    flightDisplayPolicy,
    verygoodtourPublicRowFactsOnly,
    useModetourDirectedParse,
    useKyowontourPublicFlightScrub,
    useLottetourPublicFlightScrub,
  } = input

  const baseFactsByDate = departures.length > 0 ? buildDepartureKeyFactsMap([...departures]) : {}
  const departureKeyFactsByDepartureId =
    departures.length > 0 ? buildDepartureKeyFactsByDepartureId([...departures]) : undefined
  const parsedFactsByDate =
    departures.length > 0
      ? verygoodtourPublicRowFactsOnly
        ? baseFactsByDate
        : enrichDepartureKeyFactsMapForDisplay(baseFactsByDate, flightStructured, productAirline)
      : undefined
  const adminFactsTemplate =
    adminFlightProfile != null ? buildKeyFactsFromAdminProfile(adminFlightProfile, productAirline) : null
  let departureKeyFactsByDate =
    departures.length === 0
      ? undefined
      : flightDisplayPolicy === 'admin_only' && adminFactsTemplate != null
        ? Object.fromEntries(
            Object.keys(baseFactsByDate).map((dateKey) => {
              const parsedRow = parsedFactsByDate?.[dateKey]
              const merged =
                parsedRow != null
                  ? mergeAdminDepartureFactsWithParsedLegs(adminFactsTemplate, parsedRow)
                  : adminFactsTemplate
              return [
                dateKey,
                {
                  ...merged,
                  meetingSummary: baseFactsByDate[dateKey]?.meetingSummary ?? merged.meetingSummary ?? null,
                },
              ]
            })
          )
        : flightDisplayPolicy === 'suppress_no_parsed'
          ? Object.fromEntries(
              Object.keys(baseFactsByDate).map((dateKey) => [
                dateKey,
                {
                  airline: adminFactsTemplate?.airline ?? baseFactsByDate[dateKey]?.airline ?? productAirline ?? null,
                  outbound: null,
                  inbound: null,
                  outboundSummary: null,
                  inboundSummary: null,
                  meetingSummary: baseFactsByDate[dateKey]?.meetingSummary ?? null,
                },
              ])
            )
          : parsedFactsByDate

  if (useModetourDirectedParse && departureKeyFactsByDate) {
    departureKeyFactsByDate = Object.fromEntries(
      Object.entries(departureKeyFactsByDate).map(([dateKey, facts]) => [
        dateKey,
        sanitizeModetourPublicDepartureKeyFacts(facts),
      ])
    )
  }
  if (useKyowontourPublicFlightScrub && departureKeyFactsByDate) {
    departureKeyFactsByDate = Object.fromEntries(
      Object.entries(departureKeyFactsByDate).map(([dateKey, facts]) => [
        dateKey,
        sanitizeKyowontourPublicDepartureKeyFacts(facts),
      ])
    )
  }
  if (useLottetourPublicFlightScrub && departureKeyFactsByDate) {
    departureKeyFactsByDate = Object.fromEntries(
      Object.entries(departureKeyFactsByDate).map(([dateKey, facts]) => [
        dateKey,
        sanitizeLottetourPublicDepartureKeyFacts(facts),
      ])
    )
  }

  return { departureKeyFactsByDate, departureKeyFactsByDepartureId }
}
