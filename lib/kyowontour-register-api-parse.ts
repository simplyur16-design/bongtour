/**
 * 교원이지(kyowontour) 등록 parseFn — URL register-facts SSOT (Gemini overlay 없음).
 *
 * REGRESSION-FREEZE[kyowontour-register-api-parse]: collectKyowontourRegisterFacts → RegisterParsed — manifest
 */
import { collectKyowontourRegisterFacts } from '@/lib/register-facts/kyowontour'
import { resolvePrefetchedRegisterFactBundle } from '@/lib/register-facts/resolve-prefetched-bundle'
import type { RegisterFactPriceRow } from '@/lib/register-facts/types'
import { registerDepartureInputToParsedPrice } from '@/lib/register-departure-input-to-parsed-price'
import type { ParsedProductPrice } from '@/lib/parsed-product-types'
import type { RegisterParsed, RegisterLlmParseOptionsCommon } from '@/lib/register-llm-schema-kyowontour'
import { finalizeKyowontourRegisterParsedPricing } from '@/lib/register-kyowontour-price'
import { finalizeKyowontourRegisterParsedShopping } from '@/lib/register-kyowontour-shopping'
import { kyowontourFactDaysToRegisterSchedule } from '@/lib/kyowontour-register-api-schedule'
import { augmentKyowontourParsedWithDetailCollect } from '@/lib/kyowontour-register-detail-collect'
import { isRegisterAirHotelListing } from '@/lib/register-admin-airtel-listing'
import { REGISTER_AIR_HOTEL_PREVIEW_POLICY_NOTE } from '@/lib/register-air-hotel-admin-path'

export const KYOWONTOUR_PRICE_SLOT_SSOT_NOTE =
  '교원이지 가격(3슬롯): adultPrice=성인, childExtraBedPrice=아동 단가, childNoBedPrice=null, infantPrice=유아. 쿠폰·총액·잔여석·출발일변경·적립·무이자 등은 슬롯에 넣지 않습니다.'

export const KYOWONTOUR_FLIGHT_PREVIEW_NOTE =
  '교원이지 항공: register-facts tourEventTabData + calendar AJAX SSOT. 편명·시간·잔여석은 달력 행에서 구조화.'

export type KyowontourRegisterApiParseOptions = Pick<
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

function resolveKyowontourRegisterDestination(title: string, paste: string): {
  destination: string
  primaryDestination: string | null
  destinationRaw: string | null
} {
  const hay = [title, paste].filter(Boolean).join(' ')
  const m = hay.match(
    /(?:^|[\s#])([가-힣A-Za-z]{2,16}(?:\s*[·/]\s*[가-힣A-Za-z]{2,12})?)\s*(?:\d+\s*박|\d+\s*일|#)/u,
  )
  const dest = (m?.[1] ?? title.split(/\s+/)[0] ?? '미지정').trim()
  return {
    destination: dest || '미지정',
    primaryDestination: dest || null,
    destinationRaw: dest || null,
  }
}

/** originUrl + 선택 붙여넣기 → RegisterParsed 골격. 구조화 축은 tab-data-collect·detail-collect가 보강한다. */
export async function parseKyowontourRegisterFromApi(
  rawText: string,
  originSource: string = 'kyowontour',
  options?: KyowontourRegisterApiParseOptions,
): Promise<RegisterParsed> {
  const originUrl = (options?.originUrl ?? '').trim()
  const travelScope = options?.travelScope ?? null
  const airHotelListing = isRegisterAirHotelListing(travelScope)
  if (!originUrl || !/kyowontour\.com/i.test(originUrl)) {
    throw new Error('교원이지 등록에는 유효한 originUrl(tourCode)이 필요합니다.')
  }

  const bundle =
    resolvePrefetchedRegisterFactBundle(originUrl, options?.prefetchedFactBundle, 'kyowontour') ??
    (await collectKyowontourRegisterFacts(originUrl))
  if (!bundle) {
    throw new Error('register-facts 수집에 실패했습니다. URL·tourCode를 확인하세요.')
  }

  const paste = rawText.trim()
  const listingTitle = bundle.title?.trim() || ''
  const dest = resolveKyowontourRegisterDestination(listingTitle, paste)
  const schedule = kyowontourFactDaysToRegisterSchedule(bundle.scheduleDays)
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

  let parsed: RegisterParsed = {
    originSource: originSource?.trim() || 'kyowontour',
    originCode: bundle.originCode ?? '',
    title: listingTitle || '미지정',
    supplierListingTitleRaw: listingTitle || null,
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
    hasShopping: bundle.shoppingPlaces.some((p) => /쇼핑/.test(p)),
    shoppingVisitCount: bundle.shoppingPlaces.some((p) => /노쇼핑/.test(p))
      ? 0
      : bundle.shoppingPlaces.length > 0
        ? Number(bundle.shoppingPlaces[0]?.match(/(\d+)/)?.[1] ?? 0) || null
        : null,
    registerPreviewPolicyNotes: [
      '교원이지 등록 parse: register-facts API SSOT (Gemini overlay 없음)',
      KYOWONTOUR_PRICE_SLOT_SSOT_NOTE,
      KYOWONTOUR_FLIGHT_PREVIEW_NOTE,
      ...(airHotelListing ? [REGISTER_AIR_HOTEL_PREVIEW_POLICY_NOTE] : []),
    ],
    kyowontourScheduleCollectRan: true,
    kyowontourScheduleCollectSummary: 'register-facts tourEventTabData',
  }

  parsed = finalizeKyowontourRegisterParsedPricing(parsed)
  parsed = finalizeKyowontourRegisterParsedShopping(parsed)
  parsed = await augmentKyowontourParsedWithDetailCollect(parsed, { originUrl, travelScope })

  return parsed
}
