/**
 * 롯데관광 등록 parseFn — URL register-facts SSOT (Gemini overlay 없음).
 *
 * REGRESSION-FREEZE[lottetour-register-api-parse]: collectLottetourRegisterFacts → RegisterParsed — manifest
 * REGRESSION-FREEZE[lottetour-register-ssot-freeze]: API-only register parse — manifest
 */
import { collectLottetourRegisterFacts } from '@/lib/register-facts/lottetour'
import { resolvePrefetchedRegisterFactBundle } from '@/lib/register-facts/resolve-prefetched-bundle'
import {
  resolveLottetourRegisterOriginIdsFromUrl,
} from '@/lib/lottetour-register-api-detail'
import type { RegisterFactPriceRow } from '@/lib/register-facts/types'
import { registerDepartureInputToParsedPrice } from '@/lib/register-departure-input-to-parsed-price'
import type { ParsedProductPrice } from '@/lib/parsed-product-types'
import type { RegisterParsed, RegisterLlmParseOptionsCommon } from '@/lib/register-llm-schema-lottetour'
import { finalizeLottetourRegisterParsedPricing } from '@/lib/register-lottetour-price'
import { finalizeLottetourRegisterParsedShopping } from '@/lib/register-lottetour-shopping'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { lottetourFactDaysToRegisterSchedule } from '@/lib/lottetour-register-api-schedule'
import { augmentLottetourParsedWithDetailCollect } from '@/lib/lottetour-register-detail-collect'
import { isRegisterAirHotelListing } from '@/lib/register-admin-airtel-listing'
import { REGISTER_AIR_HOTEL_PREVIEW_POLICY_NOTE } from '@/lib/register-air-hotel-admin-path'
import { resolveLottetourRegisterDestination } from '@/lib/lottetour-register-destination-from-paste'
import { normalizeSupplierRegisterListingTitle } from '@/lib/supplier-product-title-display'
import { extractLottetourVerbatimListingTitle } from '@/lib/register-lottetour-basic'
import { isSupplierListingTitleUnacceptable } from '@/lib/supplier-listing-title-unacceptable'
import { applyRegisterCollectedFlightStructured } from '@/lib/register-detail-collect-flight-apply'
import { buildLottetourFlightStructuredFromFactLegs } from '@/lib/register-facts/lottetour-register-fact-flights'

export const LOTTETOUR_PRICE_SLOT_SSOT_NOTE =
  '롯데관광 가격(3슬롯): adultPrice=성인, childExtraBedPrice=아동 단가, childNoBedPrice=null, infantPrice=유아. 쿠폰·총액·잔여석·출발일변경·적립·무이자 등은 슬롯에 넣지 않습니다.'

export const LOTTETOUR_FLIGHT_PREVIEW_NOTE =
  '롯데관광 항공: originUrl detail-collect(basicAjax·scheduleAjax) SSOT. 붙여넣기 flightRaw는 보조.'

export type LottetourRegisterApiParseOptions = Pick<
  RegisterLlmParseOptionsCommon,
  'originUrl' | 'forPreview' | 'pastedBodyForInference' | 'travelScope' | 'prefetchedFactBundle'
>

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

/** originUrl + 선택 붙여넣기 → RegisterParsed 골격. 구조화 축은 detail-collect가 채운다. */
export async function parseLottetourRegisterFromApi(
  rawText: string,
  originSource: string = 'lottetour',
  options?: LottetourRegisterApiParseOptions,
): Promise<RegisterParsed> {
  const originUrl = (options?.originUrl ?? '').trim()
  const travelScope = options?.travelScope ?? null
  const airHotelListing = isRegisterAirHotelListing(travelScope)
  const ids = await resolveLottetourRegisterOriginIdsFromUrl(originUrl || rawText)
  if (!originUrl || (!ids.evtCd && !ids.godId)) {
    throw new Error('롯데관광 등록에는 유효한 originUrl(godId 또는 evtCd)이 필요합니다.')
  }

  // REGRESSION-FREEZE[register-facts-fetch-resilience]: prefetchedFactBundle skip live detail re-fetch — manifest
  const prefetched = resolvePrefetchedRegisterFactBundle(
    originUrl,
    options?.prefetchedFactBundle,
    'lottetour',
  )
  const bundle = prefetched ?? (await collectLottetourRegisterFacts(originUrl))
  if (!bundle) {
    throw new Error('register-facts 수집에 실패했습니다. URL·godId·evtCd를 확인하세요.')
  }
  const usedPrefetch = Boolean(prefetched)

  const resolvedEvtCd = bundle.originCode?.trim() || ids.evtCd
  const godFromNotes = bundle.notes?.find((n) => n.startsWith('godId='))?.slice('godId='.length)?.trim()
  const resolvedGodId = ids.godId ?? godFromNotes ?? null

  const paste = rawText.trim()
  // REGRESSION-FREEZE[lottetour-register-listing-title]: facts title → paste bracket fallback — manifest
  let listingTitle = normalizeSupplierRegisterListingTitle(bundle.title?.trim() || '')
  if (!listingTitle || isSupplierListingTitleUnacceptable(listingTitle, 'lottetour')) {
    const fromPaste = paste ? extractLottetourVerbatimListingTitle(paste) : null
    if (fromPaste && !isSupplierListingTitleUnacceptable(fromPaste, 'lottetour')) {
      listingTitle = fromPaste
    }
  }
  const dest = resolveLottetourRegisterDestination({
    pastedBody: paste,
    title: listingTitle,
  })
  const schedule = lottetourFactDaysToRegisterSchedule(bundle.scheduleDays)
  const prices = factPriceRowsToParsedPrices(bundle.priceRows)
  const anchorRow = bundle.priceRows[0]
  const productPriceTable =
    anchorRow != null
      ? {
          adultPrice: anchorRow.adultPrice ?? null,
          childExtraBedPrice: anchorRow.childPrice ?? null,
          childNoBedPrice: null,
          infantPrice: anchorRow.infantPrice ?? null,
        }
      : undefined

  const outbound = bundle.flights?.find((f) => f.direction === 'outbound')
  const inbound = bundle.flights?.find((f) => f.direction === 'inbound')
  const flightStructuredFromFacts = buildLottetourFlightStructuredFromFactLegs(bundle.flights)

  let parsed: RegisterParsed = {
    originSource: originSource?.trim() || 'lottetour',
    originCode: resolvedEvtCd ?? resolvedGodId ?? '',
    godId: resolvedGodId,
    evtCd: resolvedEvtCd,
    title: listingTitle || '미지정',
    supplierListingTitleRaw: listingTitle || bundle.title?.trim() || null,
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
    productPriceTable,
    airlineName: outbound?.carrier ?? inbound?.carrier ?? null,
    outboundFlightNo: outbound?.flightNo ?? null,
    inboundFlightNo: inbound?.flightNo ?? null,
    hasShopping: bundle.shoppingPlaces.some((p) => /쇼핑/.test(p)),
    shoppingVisitCount: bundle.shoppingPlaces.some((p) => /노쇼핑/.test(p))
      ? 0
      : bundle.shoppingPlaces.length > 0
        ? Number(bundle.shoppingPlaces[0]?.match(/(\d+)/)?.[1] ?? 0) || null
        : null,
    registerPreviewPolicyNotes: [
      '롯데관광 등록 parse: register-facts API SSOT (Gemini overlay 없음)',
      LOTTETOUR_PRICE_SLOT_SSOT_NOTE,
      LOTTETOUR_FLIGHT_PREVIEW_NOTE,
      ...(airHotelListing ? [REGISTER_AIR_HOTEL_PREVIEW_POLICY_NOTE] : []),
      ...(usedPrefetch ? ['prefetchedFactBundle: detail 재수집 생략 (사실 가져오기 SSOT)'] : []),
    ],
    // REGRESSION-FREEZE[register-facts-fetch-resilience]: prefetch → augment papi 재수집 금지 — manifest
    lottetourDetailCollectRan: usedPrefetch,
    lottetourDetailCollectSummary: usedPrefetch
      ? 'prefetchedFactBundle — detail re-fetch skipped'
      : null,
  }

  // REGRESSION-FREEZE[lottetour-register-api-parse]: prefetch facts flights → flightStructured — manifest
  parsed = applyRegisterCollectedFlightStructured(parsed, flightStructuredFromFacts)

  parsed = finalizeLottetourRegisterParsedPricing(parsed)
  parsed = finalizeLottetourRegisterParsedShopping(parsed)
  if (!usedPrefetch) {
    parsed = await augmentLottetourParsedWithDetailCollect(parsed, { originUrl, travelScope })
  }

  // prefetch면 post-augment가 imageKeyword 1회만 적용(중복 apply 금지)
  if ((parsed.schedule?.length ?? 0) > 0 && !airHotelListing && !usedPrefetch) {
    const destHint = parsed.primaryDestination ?? parsed.destination ?? null
    parsed = {
      ...parsed,
      schedule: applyRegisterScheduleImageKeywordsBySupplier(parsed.schedule ?? [], {
        supplierKey: 'lottetour',
        productDestination: destHint,
        productTitle: parsed.title,
      }),
    }
  }

  return parsed
}
