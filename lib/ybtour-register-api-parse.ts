/**
 * 노랑풍선 등록 parseFn — URL register-facts SSOT (Gemini overlay 없음).
 *
 * REGRESSION-FREEZE[ybtour-register-api-parse]: collectYbtourRegisterFacts → RegisterParsed — manifest
 * REGRESSION-FREEZE[ybtour-register-ssot-freeze]: API-only register parse — manifest
 */
import {
  parseYbtourEvCdFromUrl,
  parseYbtourGoodsCdFromUrl,
  resolveYbtourEvCdForRegisterUrl,
} from '@/lib/ybtour-api-departures'
import {
  fetchYbtourRegisterDetailBundle,
  ybtourScheduleBundleToRegisterSchedule,
} from '@/lib/ybtour-register-api-detail'
import { resolveYbtourRegisterDestination } from '@/lib/ybtour-register-destination-from-paste'
import { collectYbtourRegisterFacts } from '@/lib/register-facts/ybtour'
import type { RegisterFactPriceRow, RegisterFactScheduleDay } from '@/lib/register-facts/types'
import { registerDepartureInputToParsedPrice } from '@/lib/register-departure-input-to-parsed-price'
import type { ParsedProductPrice } from '@/lib/parsed-product-types'
import type { RegisterParsed, RegisterLlmParseOptionsCommon } from '@/lib/register-llm-schema-ybtour'
import { finalizeYbtourRegisterParsedPricing } from '@/lib/register-ybtour-price'
import { finalizeYbtourRegisterParsedShopping } from '@/lib/register-ybtour-shopping'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'

export const YBTOUR_PRICE_SLOT_SSOT_NOTE =
  '노랑풍선 가격(3슬롯): adultPrice=성인, childExtraBedPrice=아동 단가, childNoBedPrice=null, infantPrice=유아. 쿠폰·총액·잔여석·출발일변경·적립·무이자 등은 슬롯에 넣지 않습니다.'

export const YBTOUR_FLIGHT_PREVIEW_NOTE =
  '노랑풍선 항공: originUrl detail-collect(papi) SSOT. 본문 flightRaw는 보조이며 API 수집이 구조화 필드를 덮어쓴다.'

export type YbtourRegisterApiParseOptions = Pick<
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

function factSchedulePlacesToTravelCitiesRaw(days: RegisterFactScheduleDay[]): string | null {
  const out: string[] = []
  const seen = new Set<string>()
  for (const day of days) {
    for (const raw of day.places) {
      const label = String(raw ?? '')
        .replace(/\s*\([^)]*\)\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (label.length < 2 || label.length > 80) continue
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

function factDaysToRegisterSchedule(days: RegisterFactScheduleDay[]): RegisterParsed['schedule'] {
  return days.map((day) => ({
    day: day.day,
    title: `${day.day}일차`,
    description: day.places.join(' · ') || `${day.day}일차`,
    routeText: day.places.length > 0 ? day.places.join(' - ') : null,
    imageKeyword: '',
    imageKeyword2: null,
    hotelText: day.hotels[0] ?? null,
    breakfastText: day.meals[0] ?? null,
    lunchText: day.meals[1] ?? null,
    dinnerText: day.meals[2] ?? null,
  }))
}

/** originUrl + 선택 붙여넣기 → RegisterParsed 골격. 구조화 축은 detail-collect가 채운다. */
export async function parseYbtourRegisterFromApi(
  rawText: string,
  originSource: string = 'ybtour',
  options?: YbtourRegisterApiParseOptions,
): Promise<RegisterParsed> {
  const originUrl = (options?.originUrl ?? '').trim()
  if (!originUrl || (!parseYbtourEvCdFromUrl(originUrl) && !parseYbtourGoodsCdFromUrl(originUrl))) {
    throw new Error('노랑풍선 등록에는 유효한 originUrl(evCd 또는 goodsCd)이 필요합니다.')
  }

  const resolved = await resolveYbtourEvCdForRegisterUrl(originUrl)
  if (!resolved) {
    throw new Error('register-facts 수집에 실패했습니다. URL·evCd/goodsCd를 확인하세요.')
  }

  const bundle = await collectYbtourRegisterFacts(originUrl)
  if (!bundle) {
    throw new Error('register-facts 수집에 실패했습니다. URL·evCd/goodsCd를 확인하세요.')
  }

  const paste = rawText.trim()
  const listingTitle = bundle.title?.trim() || ''
  const dest = resolveYbtourRegisterDestination({
    pastedBody: paste,
    title: listingTitle,
    llmDestination: null,
  })

  const detailBundle = await fetchYbtourRegisterDetailBundle(originUrl)
  const scheduleFromDetail =
    detailBundle?.schedule &&
    (detailBundle.schedule.scheduleDetail?.length ?? 0) + (detailBundle.schedule.scheduleDetailTm?.length ?? 0) > 0
      ? ybtourScheduleBundleToRegisterSchedule(
          detailBundle.schedule.scheduleDetail ?? [],
          detailBundle.schedule.scheduleDetailTm ?? [],
        )
      : []
  const schedule =
    scheduleFromDetail.length > 0 ? scheduleFromDetail : factDaysToRegisterSchedule(bundle.scheduleDays)

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
    originSource: originSource?.trim() || 'ybtour',
    originCode: bundle.originCode ?? resolved.goodsCd ?? resolved.evCd.split('-')[0] ?? resolved.evCd,
    title: listingTitle || '미지정',
    supplierListingTitleRaw: listingTitle || null,
    destination: dest.destination || '미지정',
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
      '노랑풍선 등록 parse: register-facts API SSOT (Gemini overlay 없음)',
      YBTOUR_PRICE_SLOT_SSOT_NOTE,
      YBTOUR_FLIGHT_PREVIEW_NOTE,
    ],
    ybtourDetailCollectRan: false,
    ybtourDetailCollectSummary: null,
  }

  parsed = finalizeYbtourRegisterParsedPricing(parsed)
  parsed = finalizeYbtourRegisterParsedShopping(parsed)

  if ((parsed.schedule?.length ?? 0) > 0) {
    const destHint = parsed.primaryDestination ?? parsed.destination ?? null
    parsed = {
      ...parsed,
      schedule: applyRegisterScheduleImageKeywordsBySupplier(parsed.schedule ?? [], {
        supplierKey: 'ybtour',
        productDestination: destHint,
        productTitle: parsed.title,
      }),
    }
  }

  return parsed
}
