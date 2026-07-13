/**
 * 참좋은여행(verygoodtour) 등록 parseFn — URL register-facts SSOT (Gemini overlay 없음).
 *
 * REGRESSION-FREEZE[verygoodtour-register-api-parse]: collectVerygoodtourRegisterFacts → RegisterParsed — manifest
 */
import { collectVerygoodtourRegisterFacts, parseVerygoodProCodeFromUrl } from '@/lib/register-facts/verygoodtour'
import { resolvePrefetchedRegisterFactBundle } from '@/lib/register-facts/resolve-prefetched-bundle'
import type { RegisterFactPriceRow } from '@/lib/register-facts/types'
import { registerDepartureInputToParsedPrice } from '@/lib/register-departure-input-to-parsed-price'
import type { ParsedProductPrice } from '@/lib/parsed-product-types'
import type { RegisterParsed, RegisterLlmParseOptionsCommon } from '@/lib/register-llm-schema-verygoodtour'
import { finalizeVerygoodRegisterParsedPricing } from '@/lib/register-verygoodtour-price'
import { finalizeVerygoodRegisterParsedShopping } from '@/lib/register-verygoodtour-shopping'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { applyRegisterCollectedFlightStructured } from '@/lib/register-detail-collect-flight-apply'
import { augmentVerygoodtourParsedWithDetailCollect } from '@/lib/verygoodtour-register-detail-collect'
import { isRegisterAirHotelListing } from '@/lib/register-admin-airtel-listing'
import { REGISTER_AIR_HOTEL_PREVIEW_POLICY_NOTE } from '@/lib/register-air-hotel-admin-path'
import {
  applyVerygoodScheduleExpressionToRows,
  verygoodFactDaysToRegisterSchedule,
} from '@/lib/verygoodtour-register-api-schedule'
import {
  buildVerygoodFlightStructuredFromDetailHtml,
  extractVerygoodOptionalShoppingFromDetailHtml,
  resolveVerygoodRemainingSeatsFromPriceRows,
  parseVerygoodBookingMetaFromDetailHtml,
} from '@/lib/verygoodtour-register-api-detail'
import { htmlToVerygoodItineraryPlainText } from '@/lib/verygoodtour-itinerary-collector'
import { extractVerygoodScheduleRowsFromPasteBody } from '@/lib/verygoodtour-schedule-blocks-from-paste'
import { resolveVerygoodtourRegisterDestination } from '@/lib/verygoodtour-register-destination-from-paste'
import { extractVerygoodDestinationFromBracketTitle } from '@/lib/verygoodtour-listing-title-from-paste'

export const VERYGOOD_PRICE_SLOT_SSOT_NOTE =
  '참좋은 가격표(3슬롯): adultPrice=성인, childExtraBedPrice=아동 단가(엑베·노베 미분리), childNoBedPrice=미사용(null), infantPrice=유아. 가이드경비·잔여석·쿠폰 줄은 본가 슬롯에 넣지 않습니다.'

export const VERYGOOD_FLIGHT_PREVIEW_NOTE =
  '참좋은 항공: PackageDetail HTML SSOT. 편명·시간·잔여석은 달력·ProCode 행에서 구조화.'

export type VerygoodtourRegisterApiParseOptions = Pick<
  RegisterLlmParseOptionsCommon,
  'originUrl' | 'forPreview' | 'pastedBodyForInference' | 'travelScope' | 'prefetchedFactBundle'
>

const VERYGOODTOUR_BASE = process.env.VERYGOODTOUR_BASE_URL ?? 'https://www.verygoodtour.com'

function factPriceRowsToParsedPrices(rows: RegisterFactPriceRow[]): ParsedProductPrice[] {
  return rows
    .map((row) =>
      registerDepartureInputToParsedPrice({
        departureDate: row.departureDate ?? '',
        adultPrice: row.adultPrice,
        childBedPrice: row.childPrice,
        infantPrice: row.infantPrice,
        statusRaw: row.statusRaw,
        seatsStatusRaw: row.seatsStatusRaw,
        seatCount: row.seatCount,
        minPax: row.minPax,
        carrierName: row.carrierName,
      }),
    )
    .filter((row): row is ParsedProductPrice => row != null)
}

function buildDuration(nights: number | null, days: number | null): string {
  if (nights != null && days != null) return `${nights}박 ${days}일`
  if (days != null) return `${days}일`
  return ''
}

async function fetchVerygoodDetailHtml(originUrl: string): Promise<string | null> {
  const res = await fetch(originUrl, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'ko-KR',
      referer: VERYGOODTOUR_BASE,
    },
    signal: AbortSignal.timeout(45_000),
  }).catch(() => null)
  if (!res?.ok) return null
  return res.text()
}

/** originUrl + 선택 붙여넣기 → RegisterParsed. 구조화 축은 detail-collect가 보강한다. */
export async function parseVerygoodtourRegisterFromApi(
  rawText: string,
  originSource: string = 'verygoodtour',
  options?: VerygoodtourRegisterApiParseOptions,
): Promise<RegisterParsed> {
  const originUrl = (options?.originUrl ?? '').trim()
  const travelScope = options?.travelScope ?? null
  const airHotelListing = isRegisterAirHotelListing(travelScope)
  const proCode = parseVerygoodProCodeFromUrl(originUrl)
  if (!originUrl || !proCode || !/verygoodtour\.com/i.test(originUrl)) {
    throw new Error('참좋은여행 등록에는 유효한 originUrl(ProCode)이 필요합니다.')
  }

  const bundle =
    resolvePrefetchedRegisterFactBundle(originUrl, options?.prefetchedFactBundle, 'verygoodtour') ??
    (await collectVerygoodtourRegisterFacts(originUrl))
  if (!bundle) {
    throw new Error('register-facts 수집에 실패했습니다. URL·ProCode를 확인하세요.')
  }

  const detailHtml = await fetchVerygoodDetailHtml(originUrl)
  const paste = rawText.trim()
  const listingTitle = bundle.title?.trim() || ''
  let schedule = verygoodFactDaysToRegisterSchedule(bundle.scheduleDays)
  const prices = factPriceRowsToParsedPrices(bundle.priceRows)
  const seats = resolveVerygoodRemainingSeatsFromPriceRows(proCode, bundle.priceRows)
  const bookingMeta = detailHtml ? parseVerygoodBookingMetaFromDetailHtml(detailHtml) : null
  const remainingSeatsCount = seats.remainingSeatsCount ?? bookingMeta?.remainingSeatsCount ?? null
  const seatsStatusRaw =
    seats.seatsStatusRaw ?? bookingMeta?.seatsStatusRaw ?? null
  const anchorRow =
    bundle.priceRows.find(
      (r) => String(r.departureDate ?? '').slice(0, 10) === String(prices[0]?.date ?? '').slice(0, 10),
    ) ?? bundle.priceRows[0]
  const productPriceTable =
    anchorRow != null
      ? {
          adultPrice: anchorRow.adultPrice ?? null,
          childExtraBedPrice: anchorRow.childPrice ?? null,
          childNoBedPrice: null,
          infantPrice: anchorRow.infantPrice ?? null,
        }
      : undefined

  let optShop: ReturnType<typeof extractVerygoodOptionalShoppingFromDetailHtml> | null = null
  const flightStructured = detailHtml ? buildVerygoodFlightStructuredFromDetailHtml(detailHtml) : null
  if (detailHtml) {
    optShop = extractVerygoodOptionalShoppingFromDetailHtml(detailHtml)
    if (schedule.length === 0) {
      const plain = htmlToVerygoodItineraryPlainText(detailHtml)
      const extracted = extractVerygoodScheduleRowsFromPasteBody(plain)
      if (extracted.rows.length > 0) {
        schedule = applyVerygoodScheduleExpressionToRows(extracted.rows)
      }
    }
  }

  let parsed: RegisterParsed = {
    originSource: originSource?.trim() || 'verygoodtour',
    originCode: bundle.originCode ?? proCode,
    title: listingTitle || '미지정',
    supplierListingTitleRaw: listingTitle || null,
    destination: '미지정',
    destinationRaw: null,
    primaryDestination: null,
    duration: buildDuration(bundle.nights, bundle.days),
    includedItems: bundle.includedBullets,
    excludedItems: bundle.excludedBullets,
    includedText: bundle.includedBullets.join('\n'),
    excludedText: bundle.excludedBullets.join('\n'),
    meetingInfoRaw: bundle.meetingInfo,
    schedule,
    prices,
    productPriceTable,
    remainingSeatsCount,
    seatsStatusRaw,
    currentBookedCount: bookingMeta?.currentBookedCount ?? null,
    minimumDepartureCount: bookingMeta?.minimumDepartureCount ?? anchorRow?.minPax ?? null,
    minimumDepartureText:
      bookingMeta?.minimumDepartureCount != null
        ? `최소출발 ${bookingMeta.minimumDepartureCount}명`
        : anchorRow?.minPax != null
          ? `최소출발 ${anchorRow.minPax}명`
          : null,
    departureStatusText: bookingMeta?.departureStatusText ?? undefined,
    hasOptionalTour: optShop?.hasOptionalTour ?? undefined,
    optionalTourCount: optShop?.optionalTourCount ?? undefined,
    optionalTourSummaryText: optShop?.optionalTourSummaryText ?? undefined,
    optionalToursStructured: optShop?.optionalToursStructured ?? undefined,
    shoppingVisitCount: optShop?.shoppingVisitCount ?? undefined,
    hasShopping: optShop?.hasShopping ?? undefined,
    shoppingSummaryText: optShop?.shoppingSummaryText ?? undefined,
    shoppingStops: optShop?.shoppingStops ?? undefined,
    airline: flightStructured?.airlineName ?? null,
    airlineName: flightStructured?.airlineName ?? null,
    outboundFlightNo: flightStructured?.outbound?.flightNo ?? null,
    inboundFlightNo: flightStructured?.inbound?.flightNo ?? null,
    registerPreviewPolicyNotes: [
      '참좋은여행 등록 parse: register-facts API SSOT (Gemini overlay 없음)',
      VERYGOOD_PRICE_SLOT_SSOT_NOTE,
      VERYGOOD_FLIGHT_PREVIEW_NOTE,
      ...(airHotelListing ? [REGISTER_AIR_HOTEL_PREVIEW_POLICY_NOTE] : []),
    ],
    verygoodtourDetailCollectRan: false,
    verygoodtourDetailCollectSummary: 'register-facts+api-detail',
  }

  parsed = applyRegisterCollectedFlightStructured(parsed, flightStructured)
  parsed = finalizeVerygoodRegisterParsedPricing(parsed)
  parsed = finalizeVerygoodRegisterParsedShopping(parsed)
  parsed = await augmentVerygoodtourParsedWithDetailCollect(parsed, { originUrl, travelScope })

  const scheduleRouteTexts = (parsed.schedule ?? []).map((row) => row.routeText ?? '')
  const dest = resolveVerygoodtourRegisterDestination({
    title: listingTitle,
    pastedBody: paste,
    bracketDestination: extractVerygoodDestinationFromBracketTitle(listingTitle),
    scheduleRouteTexts,
  })
  parsed = {
    ...parsed,
    destination: dest.destination,
    destinationRaw: dest.destinationRaw ?? parsed.destinationRaw,
    primaryDestination: dest.primaryDestination,
  }

  if ((parsed.schedule?.length ?? 0) > 0 && !airHotelListing) {
    const destHint = parsed.primaryDestination ?? parsed.destination ?? null
    parsed = {
      ...parsed,
      schedule: applyRegisterScheduleImageKeywordsBySupplier(parsed.schedule ?? [], {
        supplierKey: 'verygoodtour',
        productDestination: destHint,
        productTitle: parsed.title,
      }),
    }
  }

  return parsed
}
