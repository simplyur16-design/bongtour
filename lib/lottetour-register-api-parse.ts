/**
 * 롯데관광 등록 parseFn — URL register-facts SSOT (Gemini overlay 없음).
 *
 * REGRESSION-FREEZE[lottetour-register-api-parse]: collectLottetourRegisterFacts → RegisterParsed — manifest
 * REGRESSION-FREEZE[lottetour-register-ssot-freeze]: API-only register parse — manifest
 */
import { extractLottetourMasterIdsFromBlob } from '@/lib/lottetour-paste-deterministic-patch'
import { collectLottetourRegisterFacts } from '@/lib/register-facts/lottetour'
import type { RegisterFactPriceRow } from '@/lib/register-facts/types'
import { registerDepartureInputToParsedPrice } from '@/lib/register-departure-input-to-parsed-price'
import type { ParsedProductPrice } from '@/lib/parsed-product-types'
import type { RegisterParsed, RegisterLlmParseOptionsCommon } from '@/lib/register-llm-schema-lottetour'
import { finalizeLottetourRegisterParsedPricing } from '@/lib/register-lottetour-price'
import { finalizeLottetourRegisterParsedShopping } from '@/lib/register-lottetour-shopping'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { lottetourFactDaysToRegisterSchedule } from '@/lib/lottetour-register-api-schedule'

export const LOTTETOUR_PRICE_SLOT_SSOT_NOTE =
  '롯데관광 가격(3슬롯): adultPrice=성인, childExtraBedPrice=아동 단가, childNoBedPrice=null, infantPrice=유아. 쿠폰·총액·잔여석·출발일변경·적립·무이자 등은 슬롯에 넣지 않습니다.'

export const LOTTETOUR_FLIGHT_PREVIEW_NOTE =
  '롯데관광 항공: originUrl detail-collect(basicAjax·scheduleAjax) SSOT. 붙여넣기 flightRaw는 보조.'

export type LottetourRegisterApiParseOptions = Pick<
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

function resolveLottetourRegisterDestination(title: string, paste: string): {
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

/** originUrl + 선택 붙여넣기 → RegisterParsed 골격. 구조화 축은 detail-collect가 채운다. */
export async function parseLottetourRegisterFromApi(
  rawText: string,
  originSource: string = 'lottetour',
  options?: LottetourRegisterApiParseOptions,
): Promise<RegisterParsed> {
  const originUrl = (options?.originUrl ?? '').trim()
  const ids = extractLottetourMasterIdsFromBlob(originUrl || rawText)
  if (!originUrl || !ids.evtCd) {
    throw new Error('롯데관광 등록에는 유효한 originUrl(evtCd)이 필요합니다.')
  }

  const bundle = await collectLottetourRegisterFacts(originUrl)
  if (!bundle) {
    throw new Error('register-facts 수집에 실패했습니다. URL·evtCd를 확인하세요.')
  }

  const paste = rawText.trim()
  const listingTitle = bundle.title?.trim() || ''
  const dest = resolveLottetourRegisterDestination(listingTitle, paste)
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

  let parsed: RegisterParsed = {
    originSource: originSource?.trim() || 'lottetour',
    originCode: bundle.originCode ?? ids.evtCd,
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
      '롯데관광 등록 parse: register-facts API SSOT (Gemini overlay 없음)',
      LOTTETOUR_PRICE_SLOT_SSOT_NOTE,
      LOTTETOUR_FLIGHT_PREVIEW_NOTE,
    ],
    lottetourDetailCollectRan: false,
    lottetourDetailCollectSummary: null,
  }

  parsed = finalizeLottetourRegisterParsedPricing(parsed)
  parsed = finalizeLottetourRegisterParsedShopping(parsed)

  if ((parsed.schedule?.length ?? 0) > 0) {
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
