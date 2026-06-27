/**
 * naeiltour 등록 사실 수집 — view.asp + view_process tab0/tab1.
 * REGRESSION-FREEZE[register-facts-foundation]: fetchNaeiltourRegisterDetailBundle — manifest
 */
import type { RegisterFactFlightLeg, SupplierRegisterFactBundle } from '@/lib/register-facts/types'
import {
  buildNaeiltourFlightStructuredFromHtml,
  extractNaeiltourDurationFromText,
  extractNaeiltourIncludedExcludedFromTab0,
  extractNaeiltourOptionalShoppingFromTab0,
  extractNaeiltourSeatsFromPage,
  extractNaeiltourTitleFromPage,
  fetchNaeiltourRegisterDetailBundle,
  naeiltourParsedScheduleToFactDays,
  parseNaeiltourScheduleDaysFromTab1,
} from '@/lib/naeiltour-register-api-detail'
import { parseNaeiltourGoodCdFromUrl } from '@/lib/naeiltour-http'
import { inferRegisterFactProductKindFromOriginUrl, registerFactProductKindNote } from '@/lib/register-facts/product-kind'

function inferNaeiltourRegisterFactProductKind(title: string, originUrl: string): ReturnType<typeof inferRegisterFactProductKindFromOriginUrl> {
  const hay = `${title}\n${originUrl}`
  if (/에어텔|자유\s*여행|항공\s*\+\s*호텔|air\s*hotel/i.test(hay)) return 'air_hotel_free'
  return inferRegisterFactProductKindFromOriginUrl('naeiltour', originUrl)
}

export function parseNaeiltourGoodCdFromUrlExport(originUrl: string | null | undefined): string | null {
  return parseNaeiltourGoodCdFromUrl(originUrl)
}

export async function collectNaeiltourRegisterFacts(originUrl: string): Promise<SupplierRegisterFactBundle | null> {
  const url = originUrl.trim()
  if (!url || !/naeiltour\.co\.kr/i.test(url)) return null

  const bundle = await fetchNaeiltourRegisterDetailBundle(url)
  if (!bundle) return null

  const title =
    extractNaeiltourTitleFromPage(bundle.pageHtml) ??
    stripTitleNoise(bundle.pageHtml)
  const { includedItems, excludedItems } = extractNaeiltourIncludedExcludedFromTab0(bundle.tab0Html)
  const optShop = extractNaeiltourOptionalShoppingFromTab0(bundle.tab0Html)
  const seats = extractNaeiltourSeatsFromPage(bundle.pageHtml)
  const parsedDays = parseNaeiltourScheduleDaysFromTab1(bundle.tab1Html)
  const { nights, days } = extractNaeiltourDurationFromText(
    [title, bundle.pageHtml, bundle.tab0Html].filter(Boolean).join(' '),
  )
  const flightStructured = buildNaeiltourFlightStructuredFromHtml(
    bundle.pageHtml,
    bundle.tab0Html,
    bundle.tab1Html,
  )

  const shoppingPlaces = optShop.hasShopping
    ? [optShop.shoppingSummaryText ?? '쇼핑'].filter(Boolean)
    : optShop.shoppingVisitCount === 0
      ? ['노쇼핑']
      : []

  return {
    supplier: 'naeiltour',
    fetchedAt: new Date().toISOString(),
    originUrl: url,
    originCode: bundle.goodCd,
    title,
    nights: nights ?? (parsedDays.length > 0 ? parsedDays.length - 1 : null),
    days: days ?? (parsedDays.length > 0 ? parsedDays.length : null),
    meetingInfo: extractMeetingFromTab1(bundle.tab1Html),
    includedBullets: includedItems,
    excludedBullets: excludedItems,
    shoppingPlaces,
    scheduleDays: naeiltourParsedScheduleToFactDays(parsedDays),
    flights: flightStructuredToLegs(flightStructured),
    priceRows: [],
    notes: [
      'source=naeiltour_view_asp_tabs',
      `goodCd=${bundle.goodCd}`,
      bundle.eventSeq ? `eventSeq=${bundle.eventSeq}` : 'eventSeq=',
      `schedule_days=${parsedDays.length}`,
      seats.remainingSeatsCount != null ? `remainingSeats=${seats.remainingSeatsCount}` : '',
      seats.minimumDepartureCount != null ? `minDeparture=${seats.minimumDepartureCount}` : '',
      optShop.hasOptionalTour ? 'hasOptionalTour=1' : 'hasOptionalTour=0',
      registerFactProductKindNote(inferNaeiltourRegisterFactProductKind(title ?? '', url)),
    ].filter(Boolean),
  }
}

function stripTitleNoise(html: string): string | null {
  const t = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]
  return t?.replace(/\s+/g, ' ').trim().slice(0, 200) ?? null
}

function extractMeetingFromTab1(tab1: string | null): string | null {
  if (!tab1) return null
  const m = tab1.match(/미팅[^<\n]{0,120}/i)
  return m?.[0]?.replace(/\s+/g, ' ').trim() ?? null
}

function flightStructuredToLegs(
  fs: ReturnType<typeof buildNaeiltourFlightStructuredFromHtml>,
): RegisterFactFlightLeg[] {
  if (!fs) return []
  const legs: RegisterFactFlightLeg[] = []
  const ob = fs.outbound
  const ib = fs.inbound
  if (ob?.flightNo || ob?.departureAirport || ob?.arrivalAirport) {
    legs.push({
      direction: 'outbound',
      carrier: fs.airlineName,
      flightNo: ob.flightNo,
      departureCity: ob.departureAirport,
      departureAt: ob.departureTime,
      arrivalCity: ob.arrivalAirport,
      arrivalAt: ob.arrivalTime,
    })
  }
  if (ib?.flightNo || ib?.departureAirport || ib?.arrivalAirport) {
    legs.push({
      direction: 'inbound',
      carrier: fs.airlineName,
      flightNo: ib.flightNo,
      departureCity: ib.departureAirport,
      departureAt: ib.departureTime,
      arrivalCity: ib.arrivalAirport,
      arrivalAt: ib.arrivalTime,
    })
  }
  return legs
}

export { parseNaeiltourScheduleDaysFromTab1, naeiltourScheduleEnglishLandmarksByDay } from '@/lib/naeiltour-register-api-detail'
