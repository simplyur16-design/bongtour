/**
 * 교원이지 등록 — goodsEventDetail HTML 1회 + tourEventTabData(goodsEvtTab_1·goodsEvtTab_2·goodsEvtTab_3·goodsEvtTab_7) 배치 자동 수집.
 *
 * REGRESSION-FREEZE[kyowontour-tour-event-tab-opt-shop]: register tab augment — manifest
 * REGRESSION-FREEZE[kyowontour-register-highlight-corepoints]: corePoints → highlightPoints — manifest
 */
import type { RegisterParsed } from '@/lib/register-llm-schema-kyowontour'
import type { RegisterPastedBlocksInput } from '@/lib/register-llm-blocks-kyowontour'
import { formatKyowontourHighlightPointsFromCorePoints } from '@/lib/extract-highlight-kyowontour'
import {
  KYOWONTOUR_TAB_CORE_ID,
  KYOWONTOUR_TAB_OPT_SHOP_ID,
  KYOWONTOUR_TAB_RESERVATION_ID,
  KYOWONTOUR_TAB_SCHEDULE_ID,
  extractKyowontourHiddenFieldsFromDetailHtml,
  extractTabDetailFromTabData,
  fetchKyowontourTourEventTabData,
  parseKyowontourCoreTabDetail,
  parseKyowontourOptShopTabDetail,
  parseKyowontourReservationTabDetail,
  parseKyowontourScheduleTabDetail,
} from '@/lib/kyowontour-tour-event-tab-data'
import {
  isKyowontourGoodsEventDetailUrl,
  optShopParsedToRegisterFields,
} from '@/lib/kyowontour-register-opt-shop-collect'
import { finalizeKyowontourRegisterParsedShopping } from '@/lib/register-kyowontour-shopping'
import {
  applyKyowontourScheduleCollectToParsed,
  needsKyowontourScheduleCollect,
  scheduleTabParsedToRegisterDays,
} from '@/lib/kyowontour-register-schedule-collect'
import {
  hasStructuredJsonRows,
  needsRegisterExcludedCollect,
  needsRegisterIncludedCollect,
  needsRegisterIncludedExcludedCollect,
  needsRegisterOptionalCollect,
  needsRegisterShoppingCollect,
} from '@/lib/register-detail-collect-gates'

export type KyowontourRegisterTabDataAugmentCtx = {
  originUrl?: string | null
  pastedBlocks?: Partial<Pick<RegisterPastedBlocksInput, 'optionalTour' | 'shopping'>> | null
  /** detail-collect가 이미 fetch한 HTML — 중복 fetch 방지 */
  detailHtml?: string | null
}

function hasOptionalPaste(blocks?: KyowontourRegisterTabDataAugmentCtx['pastedBlocks']): boolean {
  return Boolean(blocks?.optionalTour?.trim())
}

function hasShoppingPaste(blocks?: KyowontourRegisterTabDataAugmentCtx['pastedBlocks']): boolean {
  return Boolean(blocks?.shopping?.trim())
}

function hasStructuredOptionalRows(parsed: RegisterParsed): boolean {
  return hasStructuredJsonRows(parsed.optionalToursStructured)
}

function hasStructuredShoppingRows(parsed: RegisterParsed): boolean {
  return hasStructuredJsonRows(parsed.shoppingStops)
}

function needsOptShopCollect(parsed: RegisterParsed, ctx?: KyowontourRegisterTabDataAugmentCtx): boolean {
  const needOpt = needsRegisterOptionalCollect({
    hasOptionalPaste: hasOptionalPaste(ctx?.pastedBlocks),
    optionalToursStructured: parsed.optionalToursStructured,
    hasOptionalTour: parsed.hasOptionalTour,
  })
  const needShop = needsRegisterShoppingCollect({
    hasShoppingPaste: hasShoppingPaste(ctx?.pastedBlocks),
    shoppingStops: parsed.shoppingStops,
  })
  return needOpt || needShop
}

export function needsKyowontourIncludedCollect(parsed: RegisterParsed): boolean {
  return needsRegisterIncludedCollect(parsed)
}

export function needsKyowontourExcludedCollect(parsed: RegisterParsed): boolean {
  return needsRegisterExcludedCollect(parsed)
}

export function needsKyowontourIncludedExcludedCollect(parsed: RegisterParsed): boolean {
  return needsRegisterIncludedExcludedCollect(parsed)
}

export function needsKyowontourMustKnowCollect(parsed: RegisterParsed): boolean {
  return (parsed.mustKnowItems?.length ?? 0) === 0 && !parsed.mustKnowRaw?.trim()
}

function needsKyowontourHighlightCollect(parsed: RegisterParsed): boolean {
  return !String(parsed.highlightPointsRaw ?? '').trim() && !String(parsed.highlightPoints ?? '').trim()
}

function needsCoreTabCollect(parsed: RegisterParsed): boolean {
  // REGRESSION-FREEZE[kyowontour-register-highlight-corepoints]: highlight empty → still fetch core tab — manifest
  return (
    needsKyowontourIncludedExcludedCollect(parsed) ||
    needsKyowontourMustKnowCollect(parsed) ||
    needsKyowontourHighlightCollect(parsed)
  )
}

function needsReservationTabCollect(parsed: RegisterParsed): boolean {
  return needsKyowontourMustKnowCollect(parsed)
}

function buildTabIds(
  needSchedule: boolean,
  needOptShop: boolean,
  needCore: boolean,
  needReservation: boolean,
): string[] {
  const ids: string[] = []
  if (needCore) ids.push(KYOWONTOUR_TAB_CORE_ID)
  if (needReservation) ids.push(KYOWONTOUR_TAB_RESERVATION_ID)
  if (needSchedule) ids.push(KYOWONTOUR_TAB_SCHEDULE_ID)
  if (needOptShop) ids.push(KYOWONTOUR_TAB_OPT_SHOP_ID)
  return ids
}

type KyowontourMustKnowCategory = NonNullable<RegisterParsed['mustKnowItems']>[number]['category']

function kyowontourMustKnowCategory(title: string, body: string): KyowontourMustKnowCategory {
  const hay = `${title} ${body}`
  if (/비자|입국|여권|ETA|eTA/i.test(hay)) return '입국/비자'
  if (/안전|보험|유의|사고/i.test(hay)) return '안전/유의'
  if (/집결|탑승|미팅|공항/i.test(hay)) return '집결/탑승'
  if (/준비|짐|세면도구/i.test(hay)) return '국내준비'
  return '현지준비'
}

function applyKyowontourCoreTabToParsed(
  parsed: RegisterParsed,
  coreDetail: unknown,
  reservationDetail: unknown | null,
  summaryParts: string[],
): RegisterParsed {
  let next = parsed
  const needIncl = needsKyowontourIncludedCollect(next)
  const needExcl = needsKyowontourExcludedCollect(next)
  const needMustKnow = needsKyowontourMustKnowCollect(next)
  const core = parseKyowontourCoreTabDetail(coreDetail)

  if (needIncl || needExcl) {
    if (needIncl && core.includedItems.length > 0) {
      next = {
        ...next,
        includedItems: core.includedItems,
        includedText: core.includedItems.join('\n'),
        includedRaw: core.includedItems.join('\n'),
      }
    }
    if (needExcl && core.excludedItems.length > 0) {
      next = {
        ...next,
        excludedItems: core.excludedItems,
        excludedText: core.excludedItems.join('\n'),
        excludedRaw: core.excludedItems.join('\n'),
      }
    }
    if ((needIncl && core.includedItems.length > 0) || (needExcl && core.excludedItems.length > 0)) {
      summaryParts.push(`포함 ${core.includedItems.length}·불포함 ${core.excludedItems.length}`)
    }
    if (core.singleRoomSurchargeRaw) {
      next = {
        ...next,
        hasSingleRoomSurcharge: true,
        singleRoomSurchargeRaw: core.singleRoomSurchargeRaw,
        singleRoomSurchargeDisplayText: core.singleRoomSurchargeRaw,
        ...(core.singleRoomSurchargeAmount != null
          ? {
              singleRoomSurchargeAmount: core.singleRoomSurchargeAmount,
              singleRoomSurchargeCurrency: 'KRW' as const,
            }
          : {}),
      }
    }
    if (core.mandatoryLocalFee != null) {
      next = {
        ...next,
        mandatoryLocalFee: core.mandatoryLocalFee,
        mandatoryCurrency: core.mandatoryCurrency ?? next.mandatoryCurrency,
      }
    }
    if (core.visaNoteRaw && needExcl && !core.excludedItems.some((x) => /비자/i.test(x))) {
      const excl = [...(next.excludedItems ?? []), core.visaNoteRaw]
      next = {
        ...next,
        excludedItems: excl,
        excludedText: excl.join('\n'),
        excludedRaw: excl.join('\n'),
      }
    }
  }

  if (needMustKnow) {
    const mustItems: NonNullable<RegisterParsed['mustKnowItems']> = []
    for (const p of core.corePoints) {
      mustItems.push({
        category: kyowontourMustKnowCategory(p.title, p.body),
        title: p.title,
        body: p.body,
        raw: p.body,
      })
    }
    for (const n of core.mustKnowNotes) {
      mustItems.push({
        category: kyowontourMustKnowCategory(n.title, n.body),
        title: n.title,
        body: n.body,
        raw: n.body,
      })
    }
    if (reservationDetail) {
      const res = parseKyowontourReservationTabDetail(reservationDetail)
      for (const [title, body] of [
        ['예약 진행', res.beforeTourInfo],
        ['여행 준비', res.etcInfo],
        ['안전 안내', res.safetyInfo],
      ] as const) {
        if (!body) continue
        mustItems.push({
          category: kyowontourMustKnowCategory(title, body),
          title,
          body: body.slice(0, 800),
          raw: body.slice(0, 800),
        })
      }
      const visaChunk = res.beforeTourInfo?.match(/비자[^。.\n]{0,240}/i)?.[0]
      if (visaChunk && !mustItems.some((m) => /비자/i.test(m.body))) {
        mustItems.push({
          category: '입국/비자',
          title: '비자 안내',
          body: visaChunk.trim(),
          raw: visaChunk.trim(),
        })
      }
    }
    if (mustItems.length > 0) {
      next = {
        ...next,
        mustKnowItems: mustItems.slice(0, 12),
        mustKnowSource: 'supplier',
      }
      summaryParts.push(`핵심·안내 ${mustItems.length}건`)
    }
  }

  // REGRESSION-FREEZE[kyowontour-register-highlight-corepoints]: product corePoints → highlight
  const highlightEmpty =
    !String(next.highlightPointsRaw ?? '').trim() && !String(next.highlightPoints ?? '').trim()
  if (highlightEmpty && core.corePoints.length > 0) {
    const highlight = formatKyowontourHighlightPointsFromCorePoints(core.corePoints)
    if (highlight) {
      next = {
        ...next,
        highlightPointsRaw: highlight,
        highlightPoints: highlight,
      }
      summaryParts.push('상품핵심포인트')
    }
  }

  return next
}

/**
 * augmentParsed 이후 호출 — 붙여넣기·기존 structured·LLM 일정이 없을 때만 AJAX로 채운다.
 */
export async function augmentKyowontourParsedWithTabDataCollect(
  parsed: RegisterParsed,
  ctx?: KyowontourRegisterTabDataAugmentCtx,
): Promise<RegisterParsed> {
  // REGRESSION-FREEZE[register-facts-fetch-resilience]: prefetch → augment papi 재수집 금지 — manifest
  // REGRESSION-FREEZE[kyowontour-register-highlight-corepoints]: prefetch ran → highlight-only when empty — manifest
  if (parsed.kyowontourDetailCollectRan && !needsKyowontourHighlightCollect(parsed)) return parsed
  const originUrl = (ctx?.originUrl ?? '').trim()
  if (!originUrl || !isKyowontourGoodsEventDetailUrl(originUrl)) {
    return parsed
  }

  const needSchedule = needsKyowontourScheduleCollect(parsed)
  const needOptShop = needsOptShopCollect(parsed, ctx)
  const needCore = needsCoreTabCollect(parsed)
  const needReservation = needsReservationTabCollect(parsed)
  if (!needSchedule && !needOptShop && !needCore && !needReservation) return parsed

  const tabIds = buildTabIds(needSchedule, needOptShop, needCore, needReservation)
  let html: string
  const prefetched = ctx?.detailHtml?.trim()
  if (prefetched) {
    html = prefetched
  } else {
    try {
      html = await fetch(originUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BongTour/1.0)' },
        signal: AbortSignal.timeout(25_000),
      }).then((r) => r.text())
    } catch {
      return {
        ...parsed,
        kyowontourScheduleCollectRan: needSchedule ? false : parsed.kyowontourScheduleCollectRan,
        kyowontourScheduleCollectSummary: needSchedule
          ? '자동수집 스킵: 상세 HTML fetch 실패'
          : parsed.kyowontourScheduleCollectSummary,
        kyowontourOptShopCollectRan: needOptShop ? false : parsed.kyowontourOptShopCollectRan,
        kyowontourOptShopCollectSummary: needOptShop
          ? '자동수집 스킵: 상세 HTML fetch 실패'
          : parsed.kyowontourOptShopCollectSummary,
        kyowontourCoreCollectRan: needCore ? false : parsed.kyowontourCoreCollectRan,
        kyowontourCoreCollectSummary: needCore
          ? '자동수집 스킵: 상세 HTML fetch 실패'
          : parsed.kyowontourCoreCollectSummary,
      }
    }
  }

  const hidden = extractKyowontourHiddenFieldsFromDetailHtml(html)
  if (!hidden) {
    return {
      ...parsed,
      kyowontourScheduleCollectRan: needSchedule ? false : parsed.kyowontourScheduleCollectRan,
      kyowontourScheduleCollectSummary: needSchedule
        ? '자동수집 스킵: hidden 필드(tourId·masterCode) 없음'
        : parsed.kyowontourScheduleCollectSummary,
      kyowontourOptShopCollectRan: needOptShop ? false : parsed.kyowontourOptShopCollectRan,
      kyowontourOptShopCollectSummary: needOptShop
        ? '자동수집 스킵: hidden 필드(tourId·masterCode) 없음'
        : parsed.kyowontourOptShopCollectSummary,
      kyowontourCoreCollectRan: needCore ? false : parsed.kyowontourCoreCollectRan,
      kyowontourCoreCollectSummary: needCore
        ? '자동수집 스킵: hidden 필드(tourId·masterCode) 없음'
        : parsed.kyowontourCoreCollectSummary,
    }
  }

  const { status, data } = await fetchKyowontourTourEventTabData(hidden, tabIds, { refererUrl: originUrl })
  if (status !== 200) {
    const reason = `tourEventTabData HTTP ${status}`
    return {
      ...parsed,
      kyowontourScheduleCollectRan: needSchedule ? false : parsed.kyowontourScheduleCollectRan,
      kyowontourScheduleCollectSummary: needSchedule ? `자동수집 스킵: ${reason}` : parsed.kyowontourScheduleCollectSummary,
      kyowontourOptShopCollectRan: needOptShop ? false : parsed.kyowontourOptShopCollectRan,
      kyowontourOptShopCollectSummary: needOptShop ? `자동수집 스킵: ${reason}` : parsed.kyowontourOptShopCollectSummary,
      kyowontourCoreCollectRan: needCore ? false : parsed.kyowontourCoreCollectRan,
      kyowontourCoreCollectSummary: needCore ? `자동수집 스킵: ${reason}` : parsed.kyowontourCoreCollectSummary,
    }
  }

  let next = parsed

  if (needSchedule) {
    const scheduleDetail = extractTabDetailFromTabData(data, KYOWONTOUR_TAB_SCHEDULE_ID)
    const scheduleParsed = parseKyowontourScheduleTabDetail(scheduleDetail)
    const scheduleDays = scheduleTabParsedToRegisterDays(scheduleParsed)
    if (scheduleDays.length > 0) {
      const summary = `goodsEvtTab_2: 일정 ${scheduleDays.length}일차`
      next = applyKyowontourScheduleCollectToParsed(next, scheduleDays, summary)
    } else {
      next = {
        ...next,
        kyowontourScheduleCollectRan: false,
        kyowontourScheduleCollectSummary: '자동수집 스킵: goodsEvtTab_2 일정 0건',
      }
    }
  }

  if (needOptShop) {
    const optShopDetail = extractTabDetailFromTabData(data, KYOWONTOUR_TAB_OPT_SHOP_ID)
    const optShopParsed = parseKyowontourOptShopTabDetail(optShopDetail)
    if (optShopParsed.optionalTours.length === 0 && optShopParsed.shoppingItems.length === 0) {
      next = {
        ...next,
        kyowontourOptShopCollectRan: false,
        kyowontourOptShopCollectSummary: '자동수집 스킵: goodsEvtTab_7 선택관광·쇼핑 0건',
      }
    } else {
      const fields = optShopParsedToRegisterFields(optShopParsed)
      const needOpt = !hasOptionalPaste(ctx?.pastedBlocks) && !hasStructuredOptionalRows(next)
      const needShop = !hasShoppingPaste(ctx?.pastedBlocks) && !hasStructuredShoppingRows(next)
      if (needOpt && fields.optionalToursStructured) {
        next = {
          ...next,
          optionalToursStructured: fields.optionalToursStructured,
          optionalTourCount: fields.optionalTourCount ?? next.optionalTourCount,
          hasOptionalTour: true,
        }
      }
      if (needShop && fields.shoppingStops) {
        next = {
          ...next,
          shoppingStops: fields.shoppingStops,
          shoppingVisitCount: fields.shoppingVisitCount ?? next.shoppingVisitCount,
          hasShopping: true,
        }
        next = finalizeKyowontourRegisterParsedShopping(next)
      }
      const summary = `goodsEvtTab_7: 선택관광 ${optShopParsed.optionalTours.length}건, 쇼핑 ${optShopParsed.shoppingVisitCount}회`
      const notes = [...(next.registerPreviewPolicyNotes ?? [])]
      const note = `교원이지 선택관광/쇼핑: ${summary} (tourEventTabData goodsEvtTab_7)`
      if (!notes.includes(note)) notes.push(note)
      next = {
        ...next,
        kyowontourOptShopCollectRan: true,
        kyowontourOptShopCollectSummary: summary,
        registerPreviewPolicyNotes: notes,
      }
    }
  }

  if (needCore || needReservation) {
    const coreSummaryParts: string[] = []
    const coreDetail = extractTabDetailFromTabData(data, KYOWONTOUR_TAB_CORE_ID)
    const reservationDetail = needReservation
      ? extractTabDetailFromTabData(data, KYOWONTOUR_TAB_RESERVATION_ID)
      : null
    next = applyKyowontourCoreTabToParsed(next, coreDetail, reservationDetail, coreSummaryParts)
    if (coreSummaryParts.length > 0) {
      const summary = `goodsEvtTab_1${needReservation ? '/3' : ''}: ${coreSummaryParts.join(' · ')}`
      const notes = [...(next.registerPreviewPolicyNotes ?? [])]
      const note = `교원이지 상세카드: ${summary} (tourEventTabData)`
      if (!notes.includes(note)) notes.push(note)
      next = {
        ...next,
        kyowontourCoreCollectRan: true,
        kyowontourCoreCollectSummary: summary,
        registerPreviewPolicyNotes: notes,
      }
    } else if (needCore) {
      next = {
        ...next,
        kyowontourCoreCollectRan: false,
        kyowontourCoreCollectSummary: '자동수집 스킵: goodsEvtTab_1 핵심·포함/불포함 0건',
      }
    }
  }

  return next
}
