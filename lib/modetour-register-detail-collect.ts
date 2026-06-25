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
  fetchModetourRegisterDetailBundle,
} from '@/lib/modetour-register-api-detail'
import { modetourFactDaysToRegisterSchedule } from '@/lib/modetour-register-api-schedule'
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
import { fillRegisterScheduleImageKeywordsWithGeminiIfNeeded } from '@/lib/register-schedule-image-keyword-gemini-fill'

import { collectModetourRegisterFacts } from '@/lib/register-facts/modetour'

export type ModetourRegisterDetailAugmentCtx = {
  originUrl?: string | null
  pastedBlocks?: Partial<Pick<RegisterPastedBlocksInput, 'optionalTour' | 'shopping'>> | null
}

function bulletLinesFromText(raw: string | null | undefined): string[] {
  const t = (raw ?? '').trim()
  if (!t) return []
  return t
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s•·▪▶\-–—\d]+[.)]\s*/, '').trim())
    .filter((l) => l.length > 1 && l.length < 400)
}

function extractFeeLinesFromExcluded(excludedText: string): {
  singleRoomSurchargeRaw: string | null
  guideTipRaw: string | null
  visaRaw: string | null
} {
  const lines = bulletLinesFromText(excludedText)
  let singleRoomSurchargeRaw: string | null = null
  let guideTipRaw: string | null = null
  let visaRaw: string | null = null
  for (const line of lines) {
    if (!singleRoomSurchargeRaw && /(싱글|1인\s*객실|객실\s*1인|싱글룸|룸\s*사용)/i.test(line)) {
      singleRoomSurchargeRaw = line
    }
    if (!guideTipRaw && /(가이드|기사).*(경비|팁|비용)/i.test(line)) {
      guideTipRaw = line
    }
    if (!visaRaw && /(비자|visa)/i.test(line)) {
      visaRaw = line
    }
  }
  return { singleRoomSurchargeRaw, guideTipRaw, visaRaw }
}

function parseSingleRoomAmount(raw: string | null): number | null {
  if (!raw) return null
  const m = raw.match(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})\s*원/)
  if (!m) return null
  const n = Number(m[1]!.replace(/,/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
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

export function needsModetourScheduleCollect(parsed: RegisterParsed): boolean {
  const rows = parsed.schedule ?? []
  if (rows.length === 0) return true
  return rows.every((d) => !d.title?.trim() && !d.description?.trim())
}

/** API·붙여넣기 schedule에 routeText는 있는데 imageKeyword 규칙이 아직 안 탄 경우(미리보기 공통). */
export async function ensureModetourRegisterScheduleImageKeywords(
  parsed: RegisterParsed,
): Promise<RegisterParsed> {
  const schedule = parsed.schedule ?? []
  if (schedule.length === 0) return parsed
  const normalized = schedule.map((row) => ({
    ...row,
    imageKeyword: String(row.imageKeyword ?? '').trim(),
    imageKeyword2: row.imageKeyword2 ?? null,
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

  if (!needSchedule && !needInclExcl && !needMustKnow && !needOpt && !needShop && !needFlight) {
    return await ensureModetourRegisterScheduleImageKeywords(parsed)
  }

  const summaryParts: string[] = []
  let next: RegisterParsed = { ...parsed }

  const needDetailBundle = needInclExcl || needShop || needMustKnow || needOpt || needFlight
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
    })
    if (scheduleDays.length > 0) {
      const withKeywords = applyRegisterScheduleImageKeywordsBySupplier(scheduleDays, {
        supplierKey: 'modetour',
        productDestination: next.destination ?? null,
        productTitle: next.title ?? null,
      })
      next = { ...next, schedule: withKeywords }
      summaryParts.push(`GetScheduleList: 일정 ${withKeywords.length}일차`)
    }
  }

  const inclExcl = extractModetourIncludedExcludedFromDetailInfo(detailBundle?.detailInfo)
  if (needInclExcl && (inclExcl.includedItems.length > 0 || inclExcl.excludedItems.length > 0)) {
    const fees = extractFeeLinesFromExcluded(inclExcl.excludedText ?? '')
    if (needIncl && (inclExcl.includedItems.length > 0 || inclExcl.includedText)) {
      next = {
        ...next,
        includedItems: inclExcl.includedItems.length > 0 ? inclExcl.includedItems : next.includedItems,
        includedText: inclExcl.includedText ?? next.includedText,
        includedRaw: inclExcl.includedText ?? next.includedRaw,
      }
    }
    if (needExcl && (inclExcl.excludedItems.length > 0 || inclExcl.excludedText)) {
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
    if (fees.singleRoomSurchargeRaw) {
      const amt = parseSingleRoomAmount(fees.singleRoomSurchargeRaw)
      next = {
        ...next,
        singleRoomSurchargeRaw: fees.singleRoomSurchargeRaw,
        singleRoomSurchargeDisplayText: fees.singleRoomSurchargeRaw,
        hasSingleRoomSurcharge: true,
        ...(amt != null
          ? { singleRoomSurchargeAmount: amt, singleRoomSurchargeCurrency: 'KRW' as const }
          : {}),
      }
    }
    summaryParts.push(
      `GetProductDetailInfo: 포함 ${inclExcl.includedItems.length}·불포함 ${inclExcl.excludedItems.length}항`,
    )
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

  return await ensureModetourRegisterScheduleImageKeywords({
    ...next,
    modetourDetailCollectRan: summaryParts.length > 0,
    modetourDetailCollectSummary: summaryParts.join(' · ') || '스킵 또는 0건',
    registerPreviewPolicyNotes: notes,
  })
}
