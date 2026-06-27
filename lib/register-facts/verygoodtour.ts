/**
 * verygoodtour 등록 사실 수집 — PackageDetail HTML + procode detail API.
 * `verygoodtour-register-detail-collect`·`buildVerygoodProductCoreFromDetailHtml` SSOT 재사용.
 *
 * REGRESSION-FREEZE[register-facts-foundation]: PackageDetail fetch·메타 추출 — manifest
 * REGRESSION-FREEZE[register-facts-fetch-resilience]: PackageDetail fetch timeout — manifest
 */
import type {
  RegisterFactFlightLeg,
  RegisterFactScheduleDay,
  SupplierRegisterFactBundle,
} from '@/lib/register-facts/types'
import {
  buildVerygoodProductCoreFromDetailHtml,
  extractVerygoodDetailFlightFactsFromHtml,
  extractVerygoodIncludedExcludedFromDetailHtml,
} from '@/lib/verygoodtour-departures'
import { parseVerygoodItineraryFromDetailHtml } from '@/lib/verygoodtour-itinerary-collector'
import { dedupeVerygoodtourScheduleRoutePlaces } from '@/lib/verygoodtour-register-api-schedule'
import { collectVerygoodtourPriceInputsWithProCodeDetail } from '@/lib/verygoodtour-price-collect'
import { registerDepartureLikeToFactPriceRow } from '@/lib/register-fact-price-row'
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'
import {
  inferRegisterFactProductKindFromOriginUrl,
  registerFactProductKindNote,
} from '@/lib/register-facts/product-kind'
import type { ItineraryDayInput } from '@/lib/upsert-itinerary-days-verygoodtour'

const VERYGOODTOUR_BASE = process.env.VERYGOODTOUR_BASE_URL ?? 'https://www.verygoodtour.com'

export function parseVerygoodProCodeFromUrl(originUrl: string | null | undefined): string | null {
  const m = String(originUrl ?? '').match(/[?&]ProCode=([^&]+)/i)
  return m?.[1]?.trim() || null
}

function bulletsFromMultilineText(raw: string | null | undefined): string[] {
  const t = (raw ?? '').trim()
  if (!t) return []
  return t
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s•·▪▶\-–—\d]+[.)]\s*/, '').trim())
    .filter((l) => l.length > 1 && l.length < 400)
}

function itineraryDaysToFactDays(days: ItineraryDayInput[]): RegisterFactScheduleDay[] {
  return days.map((d) => {
    const blob = [d.poiNamesRaw, d.summaryTextRaw, d.rawBlock, d.city].filter(Boolean).join('\n')
    const routeParts = dedupeVerygoodtourScheduleRoutePlaces(
      d.poiNamesRaw?.trim()
        ? d.poiNamesRaw
            .split(/\s*-\s*/)
            .map((x) => x.trim())
            .filter(Boolean)
        : [],
    )
    const places =
      routeParts.length > 0
        ? routeParts
        : dedupeVerygoodtourScheduleRoutePlaces(
            blob
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter(Boolean),
          )
    const meals = d.meals?.trim() ? [d.meals.trim()] : []
    const hotels = d.accommodation?.trim() ? [d.accommodation.trim()] : []
    return {
      day: d.day,
      places,
      hotels,
      meals,
      transportNote: d.transport?.trim() || null,
    }
  })
}

function verygoodFlightFactsToLegs(
  facts: ReturnType<typeof extractVerygoodDetailFlightFactsFromHtml>,
): RegisterFactFlightLeg[] {
  const legs: RegisterFactFlightLeg[] = []
  if (facts.outboundDepartureAirport || facts.outboundArrivalAirport || facts.carrierName) {
    legs.push({
      direction: 'outbound',
      carrier: facts.carrierName,
      flightNo: null,
      departureCity: facts.outboundDepartureAirport,
      departureAt: null,
      arrivalCity: facts.outboundArrivalAirport,
      arrivalAt: null,
    })
  }
  if (facts.inboundDepartureAirport || facts.inboundArrivalAirport) {
    legs.push({
      direction: 'inbound',
      carrier: facts.carrierName,
      flightNo: null,
      departureCity: facts.inboundDepartureAirport,
      departureAt: null,
      arrivalCity: facts.inboundArrivalAirport,
      arrivalAt: null,
    })
  }
  return legs
}

export function buildVerygoodRegisterFactsFromDetailHtml(
  originUrl: string,
  html: string,
): SupplierRegisterFactBundle | null {
  const proCode = parseVerygoodProCodeFromUrl(originUrl)
  if (!proCode) return null

  const coreHit = buildVerygoodProductCoreFromDetailHtml(originUrl, html)
  const product = coreHit.product
  const inclExcl = extractVerygoodIncludedExcludedFromDetailHtml(html)
  const itinerary = parseVerygoodItineraryFromDetailHtml(html)
  const flightFacts = extractVerygoodDetailFlightFactsFromHtml(html)
  const productKind = inferRegisterFactProductKindFromOriginUrl('verygoodtour', originUrl)
  let includedBullets =
    bulletsFromMultilineText(product?.includedText ?? inclExcl.includedText).slice(0, 24)
  if (productKind === 'air_hotel_free') {
    const hotelLine = product?.hotelSummaryRaw?.trim()
    if (hotelLine && !includedBullets.some((b) => b.includes(hotelLine.slice(0, 12)))) {
      includedBullets = [`숙소: ${hotelLine}`, ...includedBullets].slice(0, 24)
    }
  }
  const excludedBullets =
    bulletsFromMultilineText(product?.excludedText ?? inclExcl.excludedText).slice(0, 24)
  const shoppingPlaces =
    product?.shoppingVisitCountTotal != null && product.shoppingVisitCountTotal > 0
      ? [`쇼핑 ${product.shoppingVisitCountTotal}회`]
      : product?.noShoppingFlag
        ? ['노쇼핑']
        : []

  return {
    supplier: 'verygoodtour',
    fetchedAt: new Date().toISOString(),
    originUrl,
    originCode: proCode,
    title: product?.title?.trim() || null,
    nights: product?.tripNights ?? null,
    days: product?.tripDays ?? null,
    meetingInfo: flightFacts.meetingInfoRaw ?? product?.meetingInfoRaw ?? null,
    includedBullets,
    excludedBullets,
    shoppingPlaces,
    scheduleDays: itineraryDaysToFactDays(itinerary.days),
    flights: verygoodFlightFactsToLegs(flightFacts),
    priceRows: [],
    notes: [
      'source=verygoodtour_package_detail_html',
      `proCode=${proCode}`,
      ...coreHit.notes,
      ...itinerary.notes,
      `schedule_days=${itinerary.days.length}`,
      registerFactProductKindNote(productKind),
    ],
  }
}

/** @deprecated use buildVerygoodRegisterFactsFromDetailHtml */
export function extractVerygoodRegisterFactsFromHtml(
  originUrl: string,
  html: string,
): SupplierRegisterFactBundle | null {
  return buildVerygoodRegisterFactsFromDetailHtml(originUrl, html)
}

export async function collectVerygoodtourRegisterFacts(originUrl: string): Promise<SupplierRegisterFactBundle | null> {
  const proCode = parseVerygoodProCodeFromUrl(originUrl)
  if (!proCode) return null

  const url =
    originUrl.trim() ||
    `${VERYGOODTOUR_BASE.replace(/\/$/, '')}/Product/PackageDetail?ProCode=${encodeURIComponent(proCode)}&PriceSeq=1`

  const res = await fetch(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'ko-KR',
      referer: VERYGOODTOUR_BASE,
    },
    signal: AbortSignal.timeout(45_000),
  }).catch(() => null)
  if (!res?.ok) return null
  const html = await res.text()
  const base = buildVerygoodRegisterFactsFromDetailHtml(url, html)
  if (!base) return null

  const fromYmd = kstTodayYmd()
  const toYmd = addDaysUtcYmd(fromYmd, RULE_A_WINDOW_DAYS)
  const collected = await collectVerygoodtourPriceInputsWithProCodeDetail(url, fromYmd, toYmd)
  const priceRows = collected.inputs
    .filter((x) => (x.adultPrice ?? 0) > 0)
    .map((dep) =>
      registerDepartureLikeToFactPriceRow({
        ...dep,
        supplierDepartureCode: dep.supplierDepartureCodeCandidate ?? proCode,
      }),
    )
    .filter((row): row is NonNullable<typeof row> => row != null)

  return {
    ...base,
    priceRows,
    notes: [
      ...base.notes,
      `calendar_rows=${priceRows.length}`,
      'calendar_source=hxr+procode_detail',
      collected.seedProCode ? `seed_pro_code=${collected.seedProCode}` : 'seed_pro_code=missing',
    ],
  }
}
