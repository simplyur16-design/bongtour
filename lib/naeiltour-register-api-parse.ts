/**
 * 내일투어(naeiltour) 등록 parseFn — URL register-facts SSOT (Gemini overlay 없음).
 *
 * REGRESSION-FREEZE[naeiltour-register-api-parse]: collectNaeiltourRegisterFacts → RegisterParsed — manifest
 * REGRESSION-FREEZE[naeiltour-register-ssot-freeze]: API-only register parse — manifest
 * REGRESSION-FREEZE[naeiltour-register-airtel]: travelScope=air_hotel_free — 패키지 일정·kw 생략 — manifest
 */
import { collectNaeiltourRegisterFacts, parseNaeiltourGoodCdFromUrlExport } from '@/lib/register-facts/naeiltour'
import { resolvePrefetchedRegisterFactBundle } from '@/lib/register-facts/resolve-prefetched-bundle'
import {
  buildNaeiltourFlightStructuredFromHtml,
  extractNaeiltourIncludedExcludedFromTab0,
  extractNaeiltourOptionalShoppingFromTab0,
  extractNaeiltourSeatsFromPage,
  fetchNaeiltourRegisterDetailBundle,
  naeiltourScheduleEnglishLandmarksByDay,
  parseNaeiltourScheduleDaysFromTab1,
} from '@/lib/naeiltour-register-api-detail'
import type { RegisterFactPriceRow } from '@/lib/register-facts/types'
import { registerDepartureInputToParsedPrice } from '@/lib/register-departure-input-to-parsed-price'
import type { ParsedProductPrice } from '@/lib/parsed-product-types'
import type { RegisterParsed, RegisterLlmParseOptionsCommon } from '@/lib/register-llm-schema-naeiltour'
import { finalizeNaeiltourRegisterParsedPricing } from '@/lib/register-naeiltour-price'
import { finalizeNaeiltourRegisterParsedShopping } from '@/lib/register-naeiltour-shopping'
import { normalizeNaeiltourRegisterListingTitle } from '@/lib/naeiltour-register-product-title'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { applyRegisterCollectedFlightStructured } from '@/lib/register-detail-collect-flight-apply'
import { isRegisterAirtelListing } from '@/lib/register-admin-airtel-listing'
import {
  applyNaeiltourScheduleExpressionToRows,
  naeiltourFactDaysToRegisterSchedule,
} from '@/lib/naeiltour-register-api-schedule'
import type { RegisterPastedBlocksInput } from '@/lib/register-llm-blocks-naeiltour'
import {
  needsRegisterExcludedCollect,
  needsRegisterIncludedCollect,
  needsRegisterOptionalCollect,
  needsRegisterShoppingCollect,
} from '@/lib/register-detail-collect-gates'

export const NAEILTOUR_PRICE_SLOT_SSOT_NOTE =
  '내일투어 가격(3슬롯): adultPrice=성인, childExtraBedPrice=아동, childNoBedPrice=null, infantPrice=유아. 잔여석·쿠폰·유류할증 안내는 슬롯에 넣지 않습니다.'

export const NAEILTOUR_FLIGHT_PREVIEW_NOTE =
  '내일투어 항공: view.asp + tab0/tab1 SSOT. 편명·시간·잔여석은 상세·일정 탭에서 구조화.'

export const NAEILTOUR_AIRTEL_PREVIEW_NOTE =
  '내일투어 자유여행(항공+호텔): tab1 패키지 일정·imageKeyword는 사용하지 않습니다. 예시 일정·일차별 imageKeyword는 Gemini(Fit) SSOT.'

export type NaeiltourRegisterApiParseOptions = Pick<
  RegisterLlmParseOptionsCommon,
  'originUrl' | 'forPreview' | 'pastedBodyForInference' | 'travelScope' | 'prefetchedFactBundle'
>

export type NaeiltourRegisterDetailAugmentCtx = {
  originUrl?: string | null
  travelScope?: string | null
  pastedBlocks?: Partial<Pick<RegisterPastedBlocksInput, 'optionalTour' | 'shopping'>> | null
}

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

function resolveNaeiltourRegisterDestination(title: string, paste: string): {
  destination: string
  primaryDestination: string | null
  destinationRaw: string | null
} {
  const hay = [title, paste].filter(Boolean).join(' ')
  const m =
    hay.match(/(?:베네룩스|유럽|동남아|일본|중국|홍콩|대만|미국|호주|괌|사이판)[^0-9]{0,12}/u) ??
    hay.match(/(?:^|[\s#])([가-힣A-Za-z]{2,16}(?:\s*[·/+]\s*[가-힣A-Za-z]{2,12})?)\s*(?:\d+\s*박|\d+\s*일)/u)
  const dest = (m?.[0] ?? title.split(/\s+/)[0] ?? '미지정').trim()
  return {
    destination: dest || '미지정',
    primaryDestination: dest || null,
    destinationRaw: dest || null,
  }
}

/** originUrl + 선택 붙여넣기 → RegisterParsed. 구조화 축은 detail-collect augment가 보강한다. */
export async function parseNaeiltourRegisterFromApi(
  rawText: string,
  originSource: string = 'naeiltour',
  options?: NaeiltourRegisterApiParseOptions,
): Promise<RegisterParsed> {
  const originUrl = (options?.originUrl ?? '').trim()
  const travelScope = options?.travelScope ?? null
  const airtelListing = isRegisterAirtelListing(travelScope)
  const goodCd = parseNaeiltourGoodCdFromUrlExport(originUrl)
  if (!originUrl || !goodCd || !/naeiltour\.co\.kr/i.test(originUrl)) {
    throw new Error('내일투어 등록에는 유효한 originUrl(good_cd)이 필요합니다.')
  }

  const bundle =
    resolvePrefetchedRegisterFactBundle(originUrl, options?.prefetchedFactBundle, 'naeiltour') ??
    (await collectNaeiltourRegisterFacts(originUrl))
  if (!bundle) {
    throw new Error('register-facts 수집에 실패했습니다. URL·good_cd를 확인하세요.')
  }

  const detailBundle = await fetchNaeiltourRegisterDetailBundle(originUrl)
  const parsedDays = airtelListing
    ? []
    : parseNaeiltourScheduleDaysFromTab1(detailBundle?.tab1Html ?? null)
  const englishByDay = naeiltourScheduleEnglishLandmarksByDay(parsedDays)

  const paste = rawText.trim()
  const listingTitleRaw = bundle.title?.trim() || ''
  const listingTitle = normalizeNaeiltourRegisterListingTitle(listingTitleRaw) || listingTitleRaw
  const dest = resolveNaeiltourRegisterDestination(listingTitle, paste)
  const schedule = airtelListing ? [] : naeiltourFactDaysToRegisterSchedule(bundle.scheduleDays)
  const prices = factPriceRowsToParsedPrices(bundle.priceRows)

  const seats = detailBundle ? extractNaeiltourSeatsFromPage(detailBundle.pageHtml) : null
  const optShop = extractNaeiltourOptionalShoppingFromTab0(detailBundle?.tab0Html ?? null)
  const flightStructured = detailBundle
    ? buildNaeiltourFlightStructuredFromHtml(
        detailBundle.pageHtml,
        detailBundle.tab0Html,
        detailBundle.tab1Html,
      )
    : null

  const minFromIncluded = bundle.includedBullets
    .map((b) => b.match(/최소\s*출발\s*인원\s*(\d+)/)?.[1])
    .find(Boolean)
  const minimumDepartureCount =
    seats?.minimumDepartureCount ?? (minFromIncluded ? Number(minFromIncluded) : null)

  let parsed: RegisterParsed = {
    originSource: originSource?.trim() || 'naeiltour',
    originCode: bundle.originCode ?? goodCd,
    goodCd: detailBundle?.goodCd ?? goodCd,
    eventSeq: detailBundle?.eventSeq ?? null,
    title: listingTitle || '미지정',
    supplierListingTitleRaw: listingTitleRaw || null,
    destination: dest.destination,
    destinationRaw: dest.destinationRaw,
    primaryDestination: dest.primaryDestination,
    duration: buildDuration(bundle.nights, bundle.days),
    includedItems: bundle.includedBullets,
    excludedItems: bundle.excludedBullets,
    includedText: bundle.includedBullets.join('\n'),
    excludedText: bundle.excludedBullets.join('\n'),
    meetingInfoRaw: bundle.meetingInfo,
    schedule,
    prices,
    remainingSeatsCount: seats?.remainingSeatsCount ?? null,
    currentBookedCount: seats?.currentBookedCount ?? null,
    minimumDepartureCount,
    minimumDepartureText:
      minimumDepartureCount != null ? `최소출발 ${minimumDepartureCount}명` : null,
    hasOptionalTour: optShop.hasOptionalTour,
    optionalTourSummaryText: optShop.optionalTourSummaryText ?? undefined,
    shoppingVisitCount: optShop.shoppingVisitCount,
    hasShopping: optShop.hasShopping,
    shoppingSummaryText: optShop.shoppingSummaryText ?? undefined,
    airline: flightStructured?.airlineName ?? null,
    airlineName: flightStructured?.airlineName ?? null,
    outboundFlightNo: flightStructured?.outbound?.flightNo ?? null,
    inboundFlightNo: flightStructured?.inbound?.flightNo ?? null,
    registerPreviewPolicyNotes: [
      '내일투어 등록 parse: register-facts API SSOT (Gemini overlay 없음)',
      NAEILTOUR_PRICE_SLOT_SSOT_NOTE,
      NAEILTOUR_FLIGHT_PREVIEW_NOTE,
      ...(airtelListing ? [NAEILTOUR_AIRTEL_PREVIEW_NOTE] : []),
    ],
    naeiltourDetailCollectRan: false,
    naeiltourDetailCollectSummary: 'register-facts+view-tabs',
  }

  parsed = applyRegisterCollectedFlightStructured(parsed, flightStructured)
  parsed = finalizeNaeiltourRegisterParsedPricing(parsed)
  parsed = finalizeNaeiltourRegisterParsedShopping(parsed)
  if (!airtelListing) {
    const scheduleAfterExpression = applyNaeiltourScheduleExpressionToRows(parsed.schedule ?? [])
    parsed = { ...parsed, schedule: scheduleAfterExpression }
  }

  if (!airtelListing && (parsed.schedule?.length ?? 0) > 0) {
    const destHint = parsed.primaryDestination ?? parsed.destination ?? null
    parsed = {
      ...parsed,
      schedule: applyRegisterScheduleImageKeywordsBySupplier(parsed.schedule ?? [], {
        supplierKey: 'naeiltour',
        productDestination: destHint,
        productTitle: parsed.title,
        naeiltourEnglishLandmarksByDay: englishByDay,
      }),
    }
  }

  return parsed
}

export async function augmentNaeiltourRegisterParsedFromApiCollect(
  parsed: RegisterParsed,
  ctx?: NaeiltourRegisterDetailAugmentCtx,
): Promise<RegisterParsed> {
  const originUrl = (ctx?.originUrl ?? '').trim()
  const skipPackageSchedule = isRegisterAirtelListing(ctx?.travelScope, parsed.productType)
  if (!originUrl || !/naeiltour\.co\.kr/i.test(originUrl)) {
    return { ...parsed, naeiltourDetailCollectRan: false, naeiltourDetailCollectSummary: 'no-origin-url' }
  }

  const detail = await fetchNaeiltourRegisterDetailBundle(originUrl)
  if (!detail) {
    return { ...parsed, naeiltourDetailCollectRan: true, naeiltourDetailCollectSummary: 'fetch-failed' }
  }

  let next = { ...parsed }
  const { includedItems, excludedItems } = extractNaeiltourIncludedExcludedFromTab0(detail.tab0Html)
  if (needsRegisterIncludedCollect(next) && includedItems.length) {
    next = { ...next, includedItems, includedText: includedItems.join('\n') }
  }
  if (needsRegisterExcludedCollect(next) && excludedItems.length) {
    next = { ...next, excludedItems, excludedText: excludedItems.join('\n') }
  }

  const optShop = extractNaeiltourOptionalShoppingFromTab0(detail.tab0Html)
  if (needsRegisterOptionalCollect(next) && !ctx?.pastedBlocks?.optionalTour?.trim()) {
    next = {
      ...next,
      hasOptionalTour: optShop.hasOptionalTour,
      optionalTourSummaryText: optShop.optionalTourSummaryText ?? undefined,
    }
  }
  if (needsRegisterShoppingCollect(next) && !ctx?.pastedBlocks?.shopping?.trim()) {
    next = {
      ...next,
      hasShopping: optShop.hasShopping,
      shoppingSummaryText: optShop.shoppingSummaryText ?? undefined,
      shoppingVisitCount: optShop.shoppingVisitCount,
    }
  }

  const seats = extractNaeiltourSeatsFromPage(detail.pageHtml)
  if (next.remainingSeatsCount == null && seats.remainingSeatsCount != null) {
    next = {
      ...next,
      remainingSeatsCount: seats.remainingSeatsCount,
    }
  }
  if (next.minimumDepartureCount == null && seats.minimumDepartureCount != null) {
    next = {
      ...next,
      minimumDepartureCount: seats.minimumDepartureCount,
      minimumDepartureText: `최소출발 ${seats.minimumDepartureCount}명`,
    }
  }

  const parsedDays = skipPackageSchedule ? [] : parseNaeiltourScheduleDaysFromTab1(detail.tab1Html)
  const englishByDay = naeiltourScheduleEnglishLandmarksByDay(parsedDays)
  if (!skipPackageSchedule && (next.schedule?.length ?? 0) === 0 && parsedDays.length > 0) {
    const sched = naeiltourFactDaysToRegisterSchedule(
      parsedDays.map(({ englishRouteLandmarks: _e, dateIso: _d, ...rest }) => rest),
    )
    next = {
      ...next,
      schedule: applyRegisterScheduleImageKeywordsBySupplier(
        applyNaeiltourScheduleExpressionToRows(sched),
        {
          supplierKey: 'naeiltour',
          productDestination: next.primaryDestination ?? next.destination,
          productTitle: next.title,
          naeiltourEnglishLandmarksByDay: englishByDay,
        },
      ),
    }
  }

  const fs = buildNaeiltourFlightStructuredFromHtml(detail.pageHtml, detail.tab0Html, detail.tab1Html)
  next = applyRegisterCollectedFlightStructured(next, fs)
  next = finalizeNaeiltourRegisterParsedShopping(next)

  return {
    ...next,
    goodCd: next.goodCd ?? detail.goodCd,
    eventSeq: next.eventSeq ?? detail.eventSeq,
    naeiltourDetailCollectRan: true,
    naeiltourDetailCollectSummary: 'view-tabs-collect',
  }
}