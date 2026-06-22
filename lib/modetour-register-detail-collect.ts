/**
 * 모두투어 등록 — originUrl B2C API + 상세 HTML로 상세카드 축 자동 수집.
 * 붙여넣기·LLM·정형칸 SSOT가 있으면 덮지 않음.
 *
 * REGRESSION-FREEZE[modetour-register-detail-collect]: B2C+HTML register augment — manifest
 */
import type { RegisterParsed, RegisterScheduleDay } from '@/lib/register-llm-schema-modetour'
import type { RegisterPastedBlocksInput } from '@/lib/register-llm-blocks-modetour'
import { collectModetourProductCore, parseModetourPackageProductNoFromUrl } from '@/lib/modetour-departures'
import {
  extractModetourIncludedExcludedFromDetailInfo,
  extractModetourMustKnowFromKeyPointInfo,
  extractModetourShoppingFromDetailBundle,
  fetchModetourRegisterDetailBundle,
} from '@/lib/modetour-register-api-detail'
import { collectModetourRegisterFacts } from '@/lib/register-facts/modetour'
import type { RegisterFactScheduleDay } from '@/lib/register-facts/types'
import { finalizeModetourRegisterParsedShopping } from '@/lib/register-modetour-shopping'
import {
  hasStructuredJsonRows,
  needsRegisterExcludedCollect,
  needsRegisterIncludedCollect,
  needsRegisterIncludedExcludedCollect,
  needsRegisterOptionalCollect,
  needsRegisterShoppingCollect,
} from '@/lib/register-detail-collect-gates'

export type ModetourRegisterDetailAugmentCtx = {
  originUrl?: string | null
  pastedBlocks?: Partial<Pick<RegisterPastedBlocksInput, 'optionalTour' | 'shopping'>> | null
}

function stripScheduleLabel(name: string): string {
  return name.replace(/^[\s▶■◎●#]+/, '').replace(/\s+/g, ' ').trim()
}

export function modetourFactDaysToRegisterSchedule(days: RegisterFactScheduleDay[]): RegisterScheduleDay[] {
  return days.map((d) => {
    const title = stripScheduleLabel(d.places[0] ?? d.hotels[0] ?? '') || `${d.day}일차`
    const descParts = [...d.places, d.transportNote].filter(Boolean) as string[]
    const description = descParts.map(stripScheduleLabel).join('\n') || title
    const routeText = d.places.length > 0 ? d.places.map(stripScheduleLabel).join(' - ') : null
    const hotelText = d.hotels.length > 0 ? d.hotels.join(' / ') : null
    const breakfast = d.meals.find((m) => /조식|아침/.test(m)) ?? null
    const lunch = d.meals.find((m) => /중식|점심/.test(m)) ?? null
    const dinner = d.meals.find((m) => /석식|저녁/.test(m)) ?? null
    return {
      day: d.day,
      title,
      description,
      routeText,
      imageKeyword: stripScheduleLabel(d.places[0] ?? title).slice(0, 80) || `${d.day}일차`,
      hotelText,
      breakfastText: breakfast,
      lunchText: lunch,
      dinnerText: dinner,
      mealSummaryText: d.meals.length > 0 ? d.meals.join(' / ') : null,
    }
  })
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

function hasStructuredOptional(parsed: RegisterParsed): boolean {
  return hasStructuredJsonRows(parsed.optionalToursStructured)
}

function hasStructuredShopping(parsed: RegisterParsed): boolean {
  return hasStructuredJsonRows(parsed.shoppingStops)
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
  const needOpt = needsRegisterOptionalCollect({
    hasOptionalPaste: hasOptionalPaste(ctx),
    optionalToursStructured: parsed.optionalToursStructured,
    hasOptionalTour: parsed.hasOptionalTour,
  })
  const needShop = needsRegisterShoppingCollect({
    hasShoppingPaste: hasShoppingPaste(ctx),
    shoppingStops: parsed.shoppingStops,
  })

  if (!needSchedule && !needInclExcl && !needMustKnow && !needOpt && !needShop) return parsed

  const summaryParts: string[] = []
  let next: RegisterParsed = { ...parsed }

  const needDetailBundle = needInclExcl || needShop || needMustKnow
  const [facts, detailBundle, core] = await Promise.all([
    needSchedule ? collectModetourRegisterFacts(originUrl) : Promise.resolve(null),
    needDetailBundle ? fetchModetourRegisterDetailBundle(originUrl) : Promise.resolve(null),
    needOpt ? collectModetourProductCore(originUrl) : Promise.resolve(null),
  ])

  if (needSchedule && facts?.scheduleDays.length) {
    const scheduleDays = modetourFactDaysToRegisterSchedule(facts.scheduleDays)
    if (scheduleDays.length > 0) {
      next = { ...next, schedule: scheduleDays }
      summaryParts.push(`GetScheduleList: 일정 ${scheduleDays.length}일차`)
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
  if (needShop && shopping.shoppingVisitCount != null) {
    next = {
      ...next,
      shoppingVisitCount: shopping.shoppingVisitCount,
      hasShopping: shopping.noShoppingFlag === true ? false : shopping.shoppingVisitCount > 0,
      ...(shopping.noShoppingFlag === true ? { shoppingVisitCount: 0 } : {}),
    }
    next = finalizeModetourRegisterParsedShopping(next)
    summaryParts.push(`GetPackageInfo: 쇼핑 ${shopping.shoppingVisitCount}회`)
  }

  const product = core?.product
  if (needOpt && product) {
    if (product.hasOptionalTours === true && product.optionalTourSummaryRaw) {
      next = {
        ...next,
        hasOptionalTour: true,
        optionalTourSummaryText: product.optionalTourSummaryRaw.slice(0, 280),
      }
      summaryParts.push('상세HTML: 선택관광 요약')
    } else if (product.noOptionFlag === true || product.hasOptionalTours === false) {
      next = { ...next, hasOptionalTour: false, optionalTourCount: 0 }
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

  const notes = [...(next.registerPreviewPolicyNotes ?? [])]
  const note =
    summaryParts.length > 0
      ? `모두투어 상세카드 자동수집: ${summaryParts.join(' · ')}`
      : '모두투어 상세카드 자동수집: 해당 축 데이터 없음(붙여넣기·LLM 우선)'
  if (!notes.includes(note)) notes.push(note)

  return {
    ...next,
    modetourDetailCollectRan: summaryParts.length > 0,
    modetourDetailCollectSummary: summaryParts.join(' · ') || '스킵 또는 0건',
    registerPreviewPolicyNotes: notes,
  }
}
