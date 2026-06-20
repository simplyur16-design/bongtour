/**
 * 하나투어 등록 — gw API로 상세카드 축 자동 수집.
 * 붙여넣기·LLM·정형칸 SSOT가 있으면 덮지 않음.
 *
 * REGRESSION-FREEZE[hanatour-register-detail-collect]: augmentHanatourParsedWithDetailCollect — manifest
 */
import type { RegisterParsed } from '@/lib/register-llm-schema-hanatour'
import type { RegisterPastedBlocksInput } from '@/lib/register-llm-blocks-hanatour'
import {
  extractHanatourCorePoints,
  extractHanatourFeesFromProdInfo,
  extractHanatourIncludedExcluded,
  extractHanatourOptionalToursFromItnr,
  extractHanatourShoppingFromProdInfo,
  fetchHanatourRegisterDetailBundle,
  hanatourFactDaysToRegisterSchedule,
  hanatourItnrToFactDays,
  optionalRowsToStructuredJson,
  shoppingRowsToStopsJson,
  type HanatourProdInfoExtended,
} from '@/lib/hanatour-register-api-detail'
import { finalizeHanatourRegisterParsedShopping } from '@/lib/register-hanatour-shopping'
import { parseHanatourPkgCdFromUrl } from '@/lib/hanatour-api-departures'

export type HanatourRegisterDetailAugmentCtx = {
  originUrl?: string | null
  pastedBlocks?: Partial<Pick<RegisterPastedBlocksInput, 'optionalTour' | 'shopping'>> | null
}

function hasOptionalPaste(ctx?: HanatourRegisterDetailAugmentCtx): boolean {
  return Boolean(ctx?.pastedBlocks?.optionalTour?.trim())
}

function hasShoppingPaste(ctx?: HanatourRegisterDetailAugmentCtx): boolean {
  return Boolean(ctx?.pastedBlocks?.shopping?.trim())
}

function hasStructuredOptional(parsed: RegisterParsed): boolean {
  const raw = parsed.optionalToursStructured
  if (!raw?.trim()) return false
  try {
    const arr = JSON.parse(raw) as unknown
    return Array.isArray(arr) && arr.length > 0
  } catch {
    return false
  }
}

function hasStructuredShopping(parsed: RegisterParsed): boolean {
  const raw = parsed.shoppingStops
  if (!raw?.trim()) return false
  try {
    const arr = JSON.parse(raw) as unknown
    return Array.isArray(arr) && arr.length > 0
  } catch {
    return false
  }
}

export function needsHanatourScheduleCollect(parsed: RegisterParsed): boolean {
  const rows = parsed.schedule ?? []
  if (rows.length === 0) return true
  return rows.every((d) => !d.title?.trim() && !d.description?.trim())
}

export function needsHanatourIncludedExcludedCollect(parsed: RegisterParsed): boolean {
  const hasIncl = (parsed.includedItems?.length ?? 0) > 0 || Boolean(parsed.includedText?.trim())
  const hasExcl = (parsed.excludedItems?.length ?? 0) > 0 || Boolean(parsed.excludedText?.trim())
  return !hasIncl && !hasExcl
}

export function needsHanatourMustKnowCollect(parsed: RegisterParsed): boolean {
  return (parsed.mustKnowItems?.length ?? 0) === 0 && !parsed.mustKnowRaw?.trim()
}

function applyProdInfoFields(
  parsed: RegisterParsed,
  info: HanatourProdInfoExtended,
  summaryParts: string[],
): RegisterParsed {
  let next = parsed

  const { includedItems, excludedItems } = extractHanatourIncludedExcluded(info)
  if (includedItems.length > 0) {
    next = {
      ...next,
      includedItems,
      includedText: includedItems.join('\n'),
      includedRaw: includedItems.join('\n'),
    }
  }
  if (excludedItems.length > 0) {
    next = {
      ...next,
      excludedItems,
      excludedText: excludedItems.join('\n'),
      excludedRaw: excludedItems.join('\n'),
    }
    summaryParts.push(`포함 ${includedItems.length}·불포함 ${excludedItems.length}`)
  }

  const fees = extractHanatourFeesFromProdInfo(info)
  if (fees.singleRoomSurchargeRaw || fees.singleRoomSurchargeAmount != null) {
    next = {
      ...next,
      hasSingleRoomSurcharge: true,
      singleRoomSurchargeRaw: fees.singleRoomSurchargeRaw,
      singleRoomSurchargeDisplayText: fees.singleRoomSurchargeRaw,
      ...(fees.singleRoomSurchargeAmount != null
        ? {
            singleRoomSurchargeAmount: fees.singleRoomSurchargeAmount,
            singleRoomSurchargeCurrency: 'KRW' as const,
          }
        : {}),
    }
  }
  if (fees.mandatoryLocalFee != null) {
    next = {
      ...next,
      mandatoryLocalFee: fees.mandatoryLocalFee,
      mandatoryCurrency: fees.mandatoryCurrency ?? next.mandatoryCurrency,
    }
  }

  const corePoints = extractHanatourCorePoints(info)
  if (corePoints.length > 0 && needsHanatourMustKnowCollect(next)) {
    next = {
      ...next,
      mustKnowItems: corePoints.map((p) => ({
        category: p.category,
        title: p.title,
        body: p.body,
        raw: p.body,
      })),
      mustKnowSource: 'supplier',
    }
    summaryParts.push(`핵심포인트 ${corePoints.length}건`)
  }

  return next
}

export async function augmentHanatourParsedWithDetailCollect(
  parsed: RegisterParsed,
  ctx?: HanatourRegisterDetailAugmentCtx,
): Promise<RegisterParsed> {
  const originUrl = (ctx?.originUrl ?? '').trim()
  if (!originUrl || !parseHanatourPkgCdFromUrl(originUrl)) return parsed

  const needSchedule = needsHanatourScheduleCollect(parsed)
  const needInclExcl = needsHanatourIncludedExcludedCollect(parsed)
  const needMustKnow = needsHanatourMustKnowCollect(parsed)
  const needOpt = !hasOptionalPaste(ctx?.pastedBlocks) && !hasStructuredOptional(parsed)
  const needShop =
    !hasShoppingPaste(ctx?.pastedBlocks) &&
    !hasStructuredShopping(parsed) &&
    parsed.shoppingVisitCount == null

  if (!needSchedule && !needInclExcl && !needMustKnow && !needOpt && !needShop) return parsed

  const bundle = await fetchHanatourRegisterDetailBundle(originUrl)
  if (!bundle?.prodInfo) {
    return {
      ...parsed,
      hanatourDetailCollectRan: false,
      hanatourDetailCollectSummary: '자동수집 스킵: getPkgProdInfo 응답 없음',
    }
  }

  const summaryParts: string[] = []
  let next: RegisterParsed = { ...parsed }
  const { prodInfo, itnr } = bundle

  if (needSchedule) {
    const factDays = hanatourItnrToFactDays(itnr)
    const scheduleDays = hanatourFactDaysToRegisterSchedule(factDays)
    if (scheduleDays.length > 0) {
      next = { ...next, schedule: scheduleDays }
      summaryParts.push(`일정 ${scheduleDays.length}일차`)
    }
  }

  if (needInclExcl || needMustKnow) {
    next = applyProdInfoFields(next, prodInfo, summaryParts)
  }

  if (needOpt) {
    const optRows = extractHanatourOptionalToursFromItnr(itnr)
    const nopt = String(prodInfo.noptYn ?? '').toUpperCase() === 'Y'
    if (optRows.length > 0) {
      const json = optionalRowsToStructuredJson(optRows)
      next = {
        ...next,
        optionalToursStructured: json,
        optionalTourCount: optRows.length,
        hasOptionalTour: true,
        optionalTourSummaryText: optRows.length > 1 ? `현지옵션 ${optRows.length}개` : '현지옵션 있음',
      }
      summaryParts.push(`선택관광 ${optRows.length}건`)
    } else if (nopt) {
      next = { ...next, hasOptionalTour: false, optionalTourCount: 0 }
    }
  }

  if (needShop) {
    const shop = extractHanatourShoppingFromProdInfo(prodInfo)
    if (shop.visitCount != null) {
      next = {
        ...next,
        shoppingVisitCount: shop.visitCount,
        hasShopping: shop.visitCount > 0,
        shoppingSummaryText: shop.visitCount > 0 ? `쇼핑 ${shop.visitCount}회` : '쇼핑 없음',
      }
    }
    if (shop.rows.length > 0) {
      next = {
        ...next,
        shoppingStops: shoppingRowsToStopsJson(shop.rows),
        hasShopping: true,
      }
      summaryParts.push(`쇼핑 ${shop.rows.length}행`)
    }
    if (shop.notice) {
      next = { ...next, shoppingNoticeRaw: shop.notice }
    }
    next = finalizeHanatourRegisterParsedShopping(next)
  }

  const notes = [...(next.registerPreviewPolicyNotes ?? [])]
  const note =
    summaryParts.length > 0
      ? `하나투어 상세카드 자동수집: ${summaryParts.join(' · ')} (gw getPkgProdInfo+itnr)`
      : '하나투어 상세카드 자동수집: 해당 축 데이터 없음(붙여넣기·LLM 우선)'
  if (!notes.includes(note)) notes.push(note)

  return {
    ...next,
    hanatourDetailCollectRan: summaryParts.length > 0,
    hanatourDetailCollectSummary: summaryParts.join(' · ') || '스킵 또는 0건',
    registerPreviewPolicyNotes: notes,
  }
}
