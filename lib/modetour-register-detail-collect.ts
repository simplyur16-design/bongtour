/**
 * 모두투어 등록 — originUrl B2C API + 상세 HTML로 상세카드 축 자동 수집.
 * 붙여넣기·LLM·정형칸 SSOT가 있으면 덮지 않음.
 *
 * REGRESSION-FREEZE[modetour-register-detail-collect]: B2C+HTML register augment — manifest
 * REGRESSION-FREEZE[modetour-register-schedule-image-keyword-apply]: parse·augment 후 schedule imageKeyword — manifest
 * REGRESSION-FREEZE[register-schedule-image-keyword-gemini-fill]: 규칙 후 빈 kw → Gemini — manifest
 * REGRESSION-FREEZE[modetour-register-ssot-freeze]: preview=confirm imageKeyword SSOT — manifest
 * REGRESSION-FREEZE[modetour-register-danang-live-gate]: GetOptionalTourList·GetShoppingList — manifest
 */
import type { RegisterParsed, RegisterScheduleDay } from '@/lib/register-llm-schema-modetour'
import type { RegisterPastedBlocksInput } from '@/lib/register-llm-blocks-modetour'
import { parseModetourPackageProductNoFromUrl } from '@/lib/modetour-departures'
import {
  extractModetourIncludedExcludedFromDetailInfo,
  extractModetourMustKnowFromKeyPointInfo,
  buildModetourFlightStructuredFromRoutes,
  extractModetourOptionalToursFromApiList,
  extractModetourShoppingFromDetailBundle,
  extractModetourShoppingStopsFromApiList,
  applyModetourSingleRoomFieldsFromFees,
  extractModetourFeesFromDetailInfo,
  fetchModetourRegisterDetailBundle,
} from '@/lib/modetour-register-api-detail'
import { modetourFactDaysToRegisterSchedule, sanitizeModetourRegisterScheduleRouteRows } from '@/lib/modetour-register-api-schedule'
export { modetourFactDaysToRegisterSchedule } from '@/lib/modetour-register-api-schedule'
import { filterModetourOptionalTourRows } from '@/lib/register-modetour-options'
import {
  finalizeModetourRegisterParsedShopping,
  reconcileModetourShoppingVisitCountWithStops,
} from '@/lib/register-modetour-shopping'
import {
  hasStructuredJsonRows,
  needsRegisterExcludedCollect,
  needsRegisterIncludedCollect,
  needsRegisterIncludedExcludedCollect,
  needsRegisterShoppingCollect,
} from '@/lib/register-detail-collect-gates'
import { applyRegisterCollectedFlightStructured,
  needsRegisterFlightApiCollect,
} from '@/lib/register-detail-collect-flight-apply'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { isRegisterAirHotelListing } from '@/lib/register-admin-airtel-listing'
import { fillRegisterScheduleImageKeywordsWithGeminiIfNeeded } from '@/lib/register-schedule-image-keyword-gemini-fill'

import { collectModetourRegisterFacts } from '@/lib/register-facts/modetour'

export type ModetourRegisterDetailAugmentCtx = {
  originUrl?: string | null
  pastedBlocks?: Partial<Pick<RegisterPastedBlocksInput, 'optionalTour' | 'shopping'>> | null
  /** 관리자 travelScope — air_hotel_free 시 패키지 imageKeyword·vibe description 생략 */
  travelScope?: string | null
}

function hasOptionalPaste(ctx?: ModetourRegisterDetailAugmentCtx): boolean {
  return Boolean(ctx?.pastedBlocks?.optionalTour?.trim())
}

function hasShoppingPaste(ctx?: ModetourRegisterDetailAugmentCtx): boolean {
  return Boolean(ctx?.pastedBlocks?.shopping?.trim())
}

function hasStructuredShopping(parsed: RegisterParsed): boolean {
  return hasStructuredJsonRows(parsed.shoppingStops)
}

/** 모두투어 — LLM hasOptionalTour=false여도 GetOptionalTourList 수집 시도 */
export function needsModetourOptionalCollect(args: {
  hasOptionalPaste: boolean
  optionalToursStructured: string | null | undefined
  declaresNoOptional?: boolean
}): boolean {
  if (args.hasOptionalPaste || hasStructuredJsonRows(args.optionalToursStructured)) return false
  if (args.declaresNoOptional) return false
  return true
}

export function needsModetourIncludedCollect(parsed: RegisterParsed): boolean {
  return needsRegisterIncludedCollect(parsed)
}

export function needsModetourExcludedCollect(parsed: RegisterParsed): boolean {
  return needsRegisterExcludedCollect(parsed)
}

export function needsModetourIncludedExcludedCollect(parsed: RegisterParsed): boolean {
  return needsRegisterIncludedExcludedCollect(parsed)
}

export function needsModetourFeeSupplementCollect(parsed: RegisterParsed): boolean {
  if (parsed.singleRoomSurchargeRaw?.trim() || parsed.singleRoomSurchargeDisplayText?.trim()) return false
  const excl = (parsed.excludedItems ?? []).map((x) => String(x).trim()).filter((x) => x.length > 2)
  if (excl.some((x) => /1인\s*객실|1인실|싱글|독실|객실\s*추가/i.test(x))) return false
  return true
}

export function needsModetourScheduleCollect(parsed: RegisterParsed): boolean {
  const rows = parsed.schedule ?? []
  if (rows.length === 0) return true
  if (rows.some((d) => !String(d.routeText ?? '').trim())) return true
  return rows.every((d) => !d.title?.trim() && !d.description?.trim())
}

/** API·붙여넣기 schedule에 routeText는 있는데 imageKeyword 규칙이 아직 안 탄 경우(미리보기 공통). */
export async function ensureModetourRegisterScheduleImageKeywords(
  parsed: RegisterParsed,
  opts?: { travelScope?: string | null },
): Promise<RegisterParsed> {
  if (isRegisterAirHotelListing(opts?.travelScope, parsed.productType)) {
    return parsed
  }
  const schedule = parsed.schedule ?? []
  if (schedule.length === 0) return parsed
  const routeSanitized = sanitizeModetourRegisterScheduleRouteRows(schedule)
  const normalized = routeSanitized.map((row) => ({
    ...row,
    imageKeyword: '',
    imageKeyword2: null,
  }))
  const withKeywords = applyRegisterScheduleImageKeywordsBySupplier(normalized, {
    supplierKey: 'modetour',
    productDestination: parsed.destination ?? null,
    productTitle: parsed.title ?? null,
  })
  const withGemini = await fillRegisterScheduleImageKeywordsWithGeminiIfNeeded(withKeywords, {
    supplierKey: 'modetour',
    productDestination: parsed.destination ?? null,
    productTitle: parsed.title ?? null,
    logLabel: 'modetour-register-schedule-image-keyword',
  })
  return { ...parsed, schedule: withGemini }
}

export function needsModetourMustKnowCollect(parsed: RegisterParsed): boolean {
  return (parsed.mustKnowItems?.length ?? 0) === 0 && !parsed.mustKnowRaw?.trim()
}

export async function augmentModetourParsedWithDetailCollect(
  parsed: RegisterParsed,
  ctx?: ModetourRegisterDetailAugmentCtx,
): Promise<RegisterParsed> {
  const originUrl = (ctx?.originUrl ?? '').trim()
  const airHotelListing = isRegisterAirHotelListing(ctx?.travelScope, parsed.productType)
  const productNo = parseModetourPackageProductNoFromUrl(originUrl)
  if (!originUrl || !productNo || productNo === '0') return parsed

  const needSchedule = needsModetourScheduleCollect(parsed)
  const needIncl = needsModetourIncludedCollect(parsed)
  const needExcl = needsModetourExcludedCollect(parsed)
  const needInclExcl = needIncl || needExcl
  const needMustKnow = needsModetourMustKnowCollect(parsed)
  const needOpt = needsModetourOptionalCollect({
    hasOptionalPaste: hasOptionalPaste(ctx),
    optionalToursStructured: parsed.optionalToursStructured,
  })
  const needShop = needsRegisterShoppingCollect({
    hasShoppingPaste: hasShoppingPaste(ctx),
    shoppingStops: parsed.shoppingStops,
  })
  const needFlight = needsRegisterFlightApiCollect(parsed)
  const needFeeSupplement = needsModetourFeeSupplementCollect(parsed)

  if (!needSchedule && !needInclExcl && !needMustKnow && !needOpt && !needShop && !needFlight && !needFeeSupplement) {
    return await ensureModetourRegisterScheduleImageKeywords(parsed, { travelScope: ctx?.travelScope })
  }

  const summaryParts: string[] = []
  let next: RegisterParsed = { ...parsed }

  const needDetailBundle = needInclExcl || needShop || needMustKnow || needOpt || needFlight || needFeeSupplement
  const [facts, detailBundle] = await Promise.all([
    needSchedule ? collectModetourRegisterFacts(originUrl) : Promise.resolve(null),
    needDetailBundle
      ? fetchModetourRegisterDetailBundle(originUrl, {
          includeOptShop: needOpt || needShop,
          includeFlight: needFlight,
        })
      : Promise.resolve(null),
  ])

  if (needSchedule && facts?.scheduleDays.length) {
    const scheduleDays = modetourFactDaysToRegisterSchedule(facts.scheduleDays, {
      productTitle: next.title ?? facts.title,
      registerAirHotelFree: airHotelListing,
    })
    if (scheduleDays.length > 0) {
      next = {
        ...next,
        schedule: airHotelListing
          ? scheduleDays
          : applyRegisterScheduleImageKeywordsBySupplier(scheduleDays, {
              supplierKey: 'modetour',
              productDestination: next.destination ?? null,
              productTitle: next.title ?? null,
            }),
      }
      summaryParts.push(`GetScheduleList: 일정 ${scheduleDays.length}일차`)
    }
  }

  const inclExcl = extractModetourIncludedExcludedFromDetailInfo(detailBundle?.detailInfo)
  const runInclExclMerge = needInclExcl || needFeeSupplement
  if (runInclExclMerge && (inclExcl.includedItems.length > 0 || inclExcl.excludedItems.length > 0)) {
    const fees = extractModetourFeesFromDetailInfo(
      detailBundle?.detailInfo,
      inclExcl.includedText,
      inclExcl.excludedText,
    )
    if (needIncl && (inclExcl.includedItems.length > 0 || inclExcl.includedText)) {
      next = {
        ...next,
        includedItems: inclExcl.includedItems.length > 0 ? inclExcl.includedItems : next.includedItems,
        includedText: inclExcl.includedText ?? next.includedText,
        includedRaw: inclExcl.includedText ?? next.includedRaw,
      }
    }
    if (needExcl || needFeeSupplement) {
      const mergedExcl = [...inclExcl.excludedItems]
      for (const extra of [fees.singleRoomSurchargeRaw, fees.guideTipRaw, fees.visaRaw]) {
        if (extra && !mergedExcl.some((x) => x.includes(extra.slice(0, 20)))) mergedExcl.push(extra)
      }
      next = {
        ...next,
        excludedItems: mergedExcl.length > 0 ? mergedExcl : next.excludedItems,
        excludedText: inclExcl.excludedText ?? next.excludedText,
        excludedRaw: inclExcl.excludedText ?? next.excludedText,
      }
    }
    next = applyModetourSingleRoomFieldsFromFees(next, fees)
    if (needInclExcl) {
      summaryParts.push(
        `GetProductDetailInfo: 포함 ${inclExcl.includedItems.length}·불포함 ${inclExcl.excludedItems.length}항`,
      )
    } else if (needFeeSupplement && fees.singleRoomSurchargeRaw) {
      summaryParts.push('GetProductDetailInfo: 1인실·부가요금 불포함 보강')
    }
  }

  const shopping = extractModetourShoppingFromDetailBundle(detailBundle?.detailInfo, detailBundle?.packageInfo)
  if (needShop) {
    const apiShopRows = extractModetourShoppingStopsFromApiList(detailBundle?.shoppingList ?? [])
    if (apiShopRows.length > 0) {
      const shopJson = JSON.stringify(apiShopRows)
      next = {
        ...next,
        shoppingStops: shopJson,
        hasShopping: true,
        shoppingVisitCount:
          shopping.shoppingVisitCount != null && shopping.shoppingVisitCount > 0
            ? shopping.shoppingVisitCount
            : apiShopRows.length,
      }
      next = reconcileModetourShoppingVisitCountWithStops(next)
      next = finalizeModetourRegisterParsedShopping(next)
      summaryParts.push(
        `GetShoppingList: 쇼핑 ${next.shoppingVisitCount ?? apiShopRows.length}회 · 행 ${apiShopRows.length}`,
      )
    } else if (shopping.shoppingVisitCount != null) {
      next = {
        ...next,
        shoppingVisitCount: shopping.shoppingVisitCount,
        hasShopping: shopping.noShoppingFlag === true ? false : shopping.shoppingVisitCount > 0,
        ...(shopping.noShoppingFlag === true ? { shoppingVisitCount: 0 } : {}),
      }
      next = finalizeModetourRegisterParsedShopping(next)
      summaryParts.push(`GetPackageInfo: 쇼핑 ${shopping.shoppingVisitCount}회`)
    }
  }

  if (needOpt && (detailBundle?.optionalTourList?.length ?? 0) > 0) {
    const optRows = filterModetourOptionalTourRows(
      extractModetourOptionalToursFromApiList(detailBundle!.optionalTourList) as {
        tourName: string
        descriptionText?: string
        noteText?: string
      }[],
    )
    if (optRows.length > 0) {
      next = {
        ...next,
        hasOptionalTour: true,
        optionalTourCount: optRows.length,
        optionalToursStructured: JSON.stringify(optRows),
        optionalTourSummaryText:
          optRows.length === 1 ? '선택관광 1건' : `선택관광 ${optRows.length}건`,
      }
      summaryParts.push(`GetOptionalTourList: 선택관광 ${optRows.length}건`)
    }
  }

  if (needMustKnow) {
    const mustKnowItems = extractModetourMustKnowFromKeyPointInfo(detailBundle?.keyPointInfo)
    if (mustKnowItems.length > 0) {
      next = {
        ...next,
        mustKnowItems,
        mustKnowSource: 'supplier',
      }
      summaryParts.push(`GetProductKeyPointInfo: 핵심포인트 ${mustKnowItems.length}건`)
    }
  }

  if (needFlight && (detailBundle?.flightRoutes?.length ?? 0) > 0) {
    const flightStructured = buildModetourFlightStructuredFromRoutes(detailBundle!.flightRoutes)
    next = applyRegisterCollectedFlightStructured(next, flightStructured)
    if (flightStructured) summaryParts.push('ItineraryDlgFlightRoute: 항공')
  }

  const notes = [...(next.registerPreviewPolicyNotes ?? [])]
  const note =
    summaryParts.length > 0
      ? `모두투어 상세카드 자동수집: ${summaryParts.join(' · ')}`
      : '모두투어 상세카드 자동수집: 해당 축 데이터 없음(붙여넣기·LLM 우선)'
  if (!notes.includes(note)) notes.push(note)

  return await ensureModetourRegisterScheduleImageKeywords(
    {
      ...next,
      modetourDetailCollectRan: summaryParts.length > 0,
      modetourDetailCollectSummary: summaryParts.join(' · ') || '스킵 또는 0건',
      registerPreviewPolicyNotes: notes,
    },
    { travelScope: ctx?.travelScope },
  )
}
