/**
 * 모두투어 등록 parseFn — URL register-facts SSOT (Gemini overlay 없음).
 *
 * REGRESSION-FREEZE[modetour-register-api-parse]: collectModetourRegisterFacts → RegisterParsed — manifest
 */
import { parseModetourPackageProductNoFromUrl } from '@/lib/modetour-departures'
import { modetourFactDaysToRegisterSchedule } from '@/lib/modetour-register-detail-collect'
import { resolveModetourRegisterProductTitle } from '@/lib/modetour-register-product-title-ssot'
import { collectModetourRegisterFacts } from '@/lib/register-facts/modetour'
import type { RegisterFactPriceRow } from '@/lib/register-facts/types'
import { registerDepartureInputToParsedPrice } from '@/lib/register-departure-input-to-parsed-price'
import type { ParsedProductPrice } from '@/lib/parsed-product-types'
import type { RegisterParsed, RegisterLlmParseOptionsCommon } from '@/lib/register-llm-schema-modetour'
import { finalizeModetourRegisterParsedPricing } from '@/lib/register-modetour-price'
import { finalizeModetourRegisterParsedShopping } from '@/lib/register-modetour-shopping'

const MODETOUR_PRICE_SLOT_SSOT_NOTE =
  '모두투어 가격표: adultPrice=성인, childExtraBedPrice=아동, childNoBedPrice=아동(무침대), infantPrice=유아. 달력은 GetOtherDepartureDates_lite SSOT.'

const MODETOUR_FLIGHT_PREVIEW_NOTE =
  '모두투어 항공: originUrl detail-collect(ItineraryDlgFlightRoute) SSOT. 붙여넣기 flightRaw는 보조.'

export type ModetourRegisterApiParseOptions = Pick<
  RegisterLlmParseOptionsCommon,
  'originUrl' | 'forPreview' | 'pastedBodyForInference'
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
export async function parseModetourRegisterFromApi(
  rawText: string,
  originSource: string = 'modetour',
  options?: ModetourRegisterApiParseOptions,
): Promise<RegisterParsed> {
  const originUrl = (options?.originUrl ?? '').trim()
  const productNo = parseModetourPackageProductNoFromUrl(originUrl)
  if (!originUrl || !productNo || productNo === '0') {
    throw new Error('모두투어 등록에는 유효한 originUrl(productNo)이 필요합니다.')
  }

  const bundle = await collectModetourRegisterFacts(originUrl, { originCode: productNo })
  if (!bundle) {
    throw new Error('register-facts 수집에 실패했습니다. URL·productNo를 확인하세요.')
  }

  const titleRes = resolveModetourRegisterProductTitle({
    pasteBlob: rawText.trim(),
    llmTitleRaw: bundle.title?.trim() ?? '',
  })

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

  let parsed: RegisterParsed = {
    originSource: originSource?.trim() || 'modetour',
    originCode: productNo,
    originUrl,
    title: titleRes.title,
    supplierListingTitleRaw: titleRes.supplierListingTitleRaw,
    destination: bundle.title?.trim() || titleRes.title,
    duration: buildDuration(bundle.nights, bundle.days),
    includedItems: bundle.includedBullets,
    excludedItems: bundle.excludedBullets,
    includedText: bundle.includedBullets.join('\n'),
    excludedText: bundle.excludedBullets.join('\n'),
    meetingInfoRaw: bundle.meetingInfo,
    schedule: modetourFactDaysToRegisterSchedule(bundle.scheduleDays),
    prices,
    productPriceTable,
    hasShopping: bundle.shoppingPlaces.some((p) => /쇼핑/.test(p)),
    shoppingVisitCount: bundle.shoppingPlaces.some((p) => /노쇼핑/.test(p))
      ? 0
      : bundle.shoppingPlaces.length > 0
        ? Number(bundle.shoppingPlaces[0]?.match(/(\d+)/)?.[1] ?? 0) || null
        : null,
    registerPreviewPolicyNotes: [
      '모두투어 등록 parse: register-facts API SSOT (Gemini overlay 없음)',
      MODETOUR_PRICE_SLOT_SSOT_NOTE,
      MODETOUR_FLIGHT_PREVIEW_NOTE,
    ],
    modetourDetailCollectRan: false,
    modetourDetailCollectSummary: null,
  }

  parsed = finalizeModetourRegisterParsedPricing(parsed)
  parsed = finalizeModetourRegisterParsedShopping(parsed)
  return parsed
}
