/**
 * 하나투어 등록 parseFn — URL register-facts SSOT (Gemini overlay 없음).
 *
 * REGRESSION-FREEZE[hanatour-register-api-parse]: collectHanatourRegisterFacts → RegisterParsed — manifest
 * REGRESSION-FREEZE[hanatour-register-schedule-2030]: 2030 TRP 일정·제목 정제 — manifest
 * REGRESSION-FREEZE[hanatour-register-ssot-freeze]: API-only register parse — manifest
 * REGRESSION-FREEZE[hanatour-register-schedule-image-keyword-apply]: parse 후 ensureHanatourRegisterScheduleImageKeywords — manifest
 */
import { parseDetailBodyStructuredHanatour } from '@/lib/detail-body-parser-hanatour'
import { applyHanatourBasicInfoBodyExtract } from '@/lib/hanatour-basic-info-body-extract'
import { parseHanatourPkgCdFromUrl } from '@/lib/hanatour-api-departures'
import { hanatourFactDaysToRegisterSchedule } from '@/lib/hanatour-register-api-detail'
import { applyHanatourOriginCodeFromPaste } from '@/lib/hanatour-origin-code-from-paste'
import { sanitizeHanatourRegisterParsedDepartureFields } from '@/lib/hanatour-departure-flight-display'
import { collectHanatourRegisterFacts } from '@/lib/register-facts/hanatour'
import type { RegisterFactPriceRow } from '@/lib/register-facts/types'
import { registerDepartureInputToParsedPrice } from '@/lib/register-departure-input-to-parsed-price'
import type { ParsedProductPrice } from '@/lib/parsed-product-types'
import type { RegisterParsed, RegisterLlmParseOptionsCommon } from '@/lib/register-llm-schema-hanatour'
import { finalizeHanatourRegisterParsedPricing } from '@/lib/register-hanatour-price'
import { finalizeHanatourRegisterParsedShopping } from '@/lib/register-hanatour-shopping'
import { isRegisterAirHotelListing } from '@/lib/register-admin-airtel-listing'
import { REGISTER_AIR_HOTEL_PREVIEW_POLICY_NOTE } from '@/lib/register-air-hotel-admin-path'
import { ensureHanatourRegisterScheduleImageKeywords, augmentHanatourParsedWithDetailCollect } from '@/lib/hanatour-register-detail-collect'
import { resolveHanatourRegisterDestination } from '@/lib/hanatour-register-destination-from-paste'
import type { RegisterFactScheduleDay } from '@/lib/register-facts/types'
import { normalizeSupplierRegisterListingTitle } from '@/lib/supplier-product-title-display'
import { polishHanatour2030RegisterBundle } from '@/lib/hanatour-register-schedule-2030'

const HANATOUR_PRICE_SLOT_SSOT_NOTE =
  '하나투어 가격표(3슬롯): adultPrice=성인, childExtraBedPrice=아동 단가, childNoBedPrice=미사용(null), infantPrice=유아. 유류·제세·기본상품가 안내·잔여석 등 메타 줄은 슬롯에 넣지 않습니다.'

const HANATOUR_FLIGHT_PREVIEW_NOTE =
  '하나투어 항공: originUrl detail-collect(pkgAirSeqList) SSOT. 본문 flightRaw는 보조이며 API 수집이 구조화 필드를 덮어쓴다.'

export type HanatourRegisterApiParseOptions = Pick<
  RegisterLlmParseOptionsCommon,
  'originUrl' | 'forPreview' | 'pastedBodyForInference' | 'travelScope'
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

function factSchedulePlacesToTravelCitiesRaw(days: RegisterFactScheduleDay[]): string | null {
  const out: string[] = []
  const seen = new Set<string>()
  for (const day of days) {
    for (const raw of day.places) {
      const label = String(raw ?? '')
        .replace(/\s*\([^)]*\)\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (label.length < 2 || label.length > 40) continue
      if (/^(?:인천|ICN|서울|김포|공항|출발|도착)$/i.test(label)) continue
      if (/조식|중식|석식|기내/i.test(label)) continue
      const key = label.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(label)
    }
  }
  return out.length > 0 ? out.slice(0, 15).join(', ') : null
}

/** originUrl + 선택 붙여넣기(혜택·쿠폰 등) → RegisterParsed 골격. 구조화 축은 detail-collect가 채운다. */
export async function parseHanatourRegisterFromApi(
  rawText: string,
  originSource: string = 'hanatour',
  options?: HanatourRegisterApiParseOptions,
): Promise<RegisterParsed> {
  const originUrl = (options?.originUrl ?? '').trim()
  const travelScope = options?.travelScope ?? null
  const airHotelListing = isRegisterAirHotelListing(travelScope)
  const pkgCd = parseHanatourPkgCdFromUrl(originUrl)
  if (!originUrl || !pkgCd) {
    throw new Error('하나투어 등록에는 유효한 originUrl(pkgCd)이 필요합니다.')
  }

  const bundle = await collectHanatourRegisterFacts(originUrl, { adminTravelScope: travelScope })
  if (!bundle) {
    throw new Error('register-facts 수집에 실패했습니다. URL·pkgCd를 확인하세요.')
  }

  const prices = factPriceRowsToParsedPrices(bundle.priceRows)
  const firstPrice = bundle.priceRows[0]
  const productPriceTable =
    firstPrice != null
      ? {
          adultPrice: firstPrice.adultPrice ?? null,
          childExtraBedPrice: firstPrice.childPrice ?? null,
          childNoBedPrice: null,
          infantPrice: firstPrice.infantPrice ?? null,
        }
      : undefined

  const rawTitle = bundle.title?.trim() || ''
  let listingTitle = normalizeSupplierRegisterListingTitle(rawTitle)
  const polished2030 = polishHanatour2030RegisterBundle({
    productTitle: rawTitle,
    factDays: bundle.scheduleDays,
    schedule: hanatourFactDaysToRegisterSchedule(bundle.scheduleDays),
    listingTitle,
  })
  listingTitle = polished2030.listingTitle
  const paste = rawText.trim()
  const dest = resolveHanatourRegisterDestination({
    pastedBody: paste,
    title: listingTitle,
    travelCitiesRaw: factSchedulePlacesToTravelCitiesRaw(polished2030.factDays),
  })

  let parsed: RegisterParsed = {
    originSource: originSource?.trim() || 'hanatour',
    originCode: bundle.originCode ?? pkgCd,
    title: listingTitle,
    destination: dest.destination || '미지정',
    destinationRaw: dest.destinationRaw,
    primaryDestination: dest.primaryDestination,
    duration: buildDuration(bundle.nights, bundle.days),
    includedItems: bundle.includedBullets,
    excludedItems: bundle.excludedBullets,
    includedText: bundle.includedBullets.join('\n'),
    excludedText: bundle.excludedBullets.join('\n'),
    meetingInfoRaw: bundle.meetingInfo,
    schedule: polished2030.schedule,
    prices,
    productPriceTable,
    registerPreviewPolicyNotes: [
      '하나투어 등록 parse: register-facts API SSOT (Gemini overlay 없음)',
      HANATOUR_PRICE_SLOT_SSOT_NOTE,
      HANATOUR_FLIGHT_PREVIEW_NOTE,
      ...(airHotelListing ? [REGISTER_AIR_HOTEL_PREVIEW_POLICY_NOTE] : []),
    ],
  }

  if (paste) {
    const detailBody = parseDetailBodyStructuredHanatour({
      rawText: paste,
      hotelRaw: null,
      optionalRaw: null,
      shoppingRaw: null,
    })
    parsed = applyHanatourBasicInfoBodyExtract(parsed, detailBody.normalizedRaw ?? paste)
    parsed = sanitizeHanatourRegisterParsedDepartureFields(parsed, detailBody.normalizedRaw ?? paste)
    parsed = applyHanatourOriginCodeFromPaste(parsed, paste)
  }

  parsed = finalizeHanatourRegisterParsedPricing(parsed)
  parsed = finalizeHanatourRegisterParsedShopping(parsed)
  parsed = await augmentHanatourParsedWithDetailCollect(parsed, { originUrl, travelScope })
  if (!airHotelListing) {
    parsed = await ensureHanatourRegisterScheduleImageKeywords(parsed, { travelScope })
  }
  return parsed
}
