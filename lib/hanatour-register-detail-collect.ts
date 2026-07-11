/**
 * 하나투어 등록 — gw API로 상세카드 축 자동 수집.
 * 붙여넣기·LLM·정형칸 SSOT가 있으면 덮지 않음.
 *
 * REGRESSION-FREEZE[hanatour-register-detail-collect]: augmentHanatourParsedWithDetailCollect — manifest
 * REGRESSION-FREEZE[hanatour-register-schedule-2030]: 2030 TRP 일정·제목 정제 — manifest
 * REGRESSION-FREEZE[register-schedule-description-vibe-ssot]: applyHanatourProdInfoIdentityFields — manifest
 * REGRESSION-FREEZE[hanatour-register-schedule-image-keyword-apply]: ensureHanatourRegisterScheduleImageKeywords — manifest
 * REGRESSION-FREEZE[hanatour-register-samples-live-gate]: SSOT 7샘플 live gate — manifest
 */
import type { RegisterParsed, RegisterScheduleDay } from '@/lib/register-llm-schema-hanatour'
import type { RegisterPastedBlocksInput } from '@/lib/register-llm-blocks-hanatour'
import {
  extractHanatourCorePoints,
  extractHanatourFeesFromProdInfo,
  extractHanatourIncludedExcluded,
  applyHanatourProdInfoHotelsToFactDays,
  buildHanatourFlightStructuredFromProdInfo,
  extractHanatourOptionalTours,
  extractHanatourShoppingFromProdInfo,
  fetchHanatourRegisterDetailBundle,
  hanatourFactDaysToRegisterSchedule,
  hanatourItnrToFactDays,
  optionalRowsToStructuredJson,
  shoppingRowsToStopsJson,
  type HanatourProdInfoExtended,
} from '@/lib/hanatour-register-api-detail'
import { finalizeHanatourRegisterParsedShopping } from '@/lib/register-hanatour-shopping'
import { resolveHanatourRegisterDestination } from '@/lib/hanatour-register-destination-from-paste'
import { parseHanatourPkgCdFromUrl } from '@/lib/hanatour-api-departures'
import {
  hasStructuredJsonRows,
  needsRegisterExcludedCollect,
  needsRegisterIncludedCollect,
  needsRegisterIncludedExcludedCollect,
  needsRegisterShoppingCollect,
} from '@/lib/register-detail-collect-gates'
import {
  applyRegisterCollectedFlightStructured,
  needsRegisterFlightApiCollect,
} from '@/lib/register-detail-collect-flight-apply'
import {
  refreshHanatourDetailBodyPolicy,
  reconcileHanatourExtractionFieldIssuesAfterDetailBodyPatch,
  hanatourOptionalTourNamesFromParsed,
} from '@/lib/register-parse-hanatour'
import { gatherHanatourScheduleSectionBodiesByDay } from '@/lib/hanatour-schedule-section-by-day'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { fillRegisterScheduleImageKeywordsWithGeminiIfNeeded } from '@/lib/register-schedule-image-keyword-gemini-fill'
import { isRegisterAirHotelListing } from '@/lib/register-admin-airtel-listing'
import { polishHanatour2030RegisterBundle } from '@/lib/hanatour-register-schedule-2030'

export type HanatourRegisterDetailAugmentCtx = {
  originUrl?: string | null
  pastedBlocks?: Partial<Pick<RegisterPastedBlocksInput, 'optionalTour' | 'shopping'>> | null
  /** 관리자 travelScope — air_hotel_free 시 패키지 imageKeyword·일정 apply 생략 */
  travelScope?: string | null
}

function hasOptionalPaste(ctx?: HanatourRegisterDetailAugmentCtx): boolean {
  return Boolean(ctx?.pastedBlocks?.optionalTour?.trim())
}

function hasShoppingPaste(ctx?: HanatourRegisterDetailAugmentCtx): boolean {
  return Boolean(ctx?.pastedBlocks?.shopping?.trim())
}

/** 하나투어 — LLM hasOptionalTour=false여도 chcStsng 전체 카탈로그 수집 시도 */
export function needsHanatourOptionalCollect(args: {
  hasOptionalPaste: boolean
  optionalToursStructured: string | null | undefined
  declaresNoOptional?: boolean
}): boolean {
  if (args.hasOptionalPaste || hasStructuredJsonRows(args.optionalToursStructured)) return false
  if (args.declaresNoOptional) return false
  return true
}

function hasStructuredOptional(parsed: RegisterParsed): boolean {
  return hasStructuredJsonRows(parsed.optionalToursStructured)
}

function hasStructuredShopping(parsed: RegisterParsed): boolean {
  return hasStructuredJsonRows(parsed.shoppingStops)
}

const HANATOUR_SCHEDULE_NOTICE_TITLE_RE =
  /유의\s*사항|예약\s*시|출입국\s*정보|여행\s*시\s*유의|참고\s*사항|여행일정\s*변경|사전\s*동의|미팅\s*정보/i

export function isHanatourPlaceholderScheduleRow(row: RegisterScheduleDay): boolean {
  const title = String(row.title ?? '').trim()
  const desc = String(row.description ?? '').trim()
  if (!title && !desc) return true
  if (title === '일차 동선' || desc === '일차 동선') return true
  if (HANATOUR_SCHEDULE_NOTICE_TITLE_RE.test(title) || HANATOUR_SCHEDULE_NOTICE_TITLE_RE.test(desc)) {
    return true
  }
  if (/^\d+\s*일차$/.test(title) && (!desc || desc === title || /^\d+\s*일차$/.test(desc))) return true

  const hasMeals = [row.breakfastText, row.lunchText, row.dinnerText].some((m) => {
    const s = String(m ?? '').trim()
    return s.length > 0 && !/^[-—–]$/.test(s)
  })
  if (hasMeals) return false

  const route = String(row.routeText ?? '').trim()
  if (route && route !== '일차 동선' && route.includes('-')) return false

  if (title && !/^\d+\s*일차$/.test(title) && title !== '일차 동선') {
    if (desc && desc !== title) return false
    if (route.length > 0) return false
  }

  return true
}

export function needsHanatourScheduleCollect(parsed: RegisterParsed): boolean {
  const rows = parsed.schedule ?? []
  if (rows.length === 0) return true
  if (rows.some((d) => !String(d.routeText ?? '').trim())) return true
  return rows.every(isHanatourPlaceholderScheduleRow)
}

/** API·붙여넣기 schedule — routeText 슬롯 규칙 + Gemini(자유일) SSOT. REGRESSION-FREEZE[hanatour-register-schedule-image-keyword-apply] */
export async function ensureHanatourRegisterScheduleImageKeywords(
  parsed: RegisterParsed,
  opts?: { travelScope?: string | null },
): Promise<RegisterParsed> {
  if (isRegisterAirHotelListing(opts?.travelScope, parsed.productType)) {
    return parsed
  }
  const schedule = parsed.schedule ?? []
  if (schedule.length === 0) return parsed
  const normalized = schedule.map((row) => ({
    ...row,
    imageKeyword: String(row.imageKeyword ?? '').trim(),
    imageKeyword2: row.imageKeyword2 ?? null,
  }))
  const withKeywords = applyRegisterScheduleImageKeywordsBySupplier(normalized, {
    supplierKey: 'hanatour',
    productDestination: parsed.primaryDestination ?? parsed.destination ?? null,
    productTitle: parsed.title ?? null,
    optionalTourNames: hanatourOptionalTourNamesFromParsed(parsed),
    scheduleSectionByDay: parsed.detailBodyStructured
      ? gatherHanatourScheduleSectionBodiesByDay(parsed.detailBodyStructured)
      : null,
  })
  const withGemini = await fillRegisterScheduleImageKeywordsWithGeminiIfNeeded(withKeywords, {
    supplierKey: 'hanatour',
    productDestination: parsed.primaryDestination ?? parsed.destination ?? null,
    productTitle: parsed.title ?? null,
    logLabel: 'hanatour-register-schedule-image-keyword',
  })
  return { ...parsed, schedule: withGemini }
}

export function needsHanatourIncludedCollect(parsed: RegisterParsed): boolean {
  return needsRegisterIncludedCollect(parsed)
}

export function needsHanatourExcludedCollect(parsed: RegisterParsed): boolean {
  return needsRegisterExcludedCollect(parsed)
}

export function needsHanatourIncludedExcludedCollect(parsed: RegisterParsed): boolean {
  return needsRegisterIncludedExcludedCollect(parsed)
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
  const needIncl = needsHanatourIncludedCollect(next)
  const needExcl = needsHanatourExcludedCollect(next)
  if (needIncl && includedItems.length > 0) {
    next = {
      ...next,
      includedItems,
      includedText: includedItems.join('\n'),
      includedRaw: includedItems.join('\n'),
    }
  }
  if (needExcl && excludedItems.length > 0) {
    next = {
      ...next,
      excludedItems,
      excludedText: excludedItems.join('\n'),
      excludedRaw: excludedItems.join('\n'),
    }
  }
  if ((needIncl && includedItems.length > 0) || (needExcl && excludedItems.length > 0)) {
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

function applyHanatourProdInfoIdentityFields(
  parsed: RegisterParsed,
  info: HanatourProdInfoExtended,
): RegisterParsed {
  let next = parsed
  const saleTitle = String(info.saleProdNm ?? '').trim()
  if (!String(next.title ?? '').trim() && saleTitle) {
    next = { ...next, title: saleTitle }
  }
  const hasDest =
    Boolean(String(next.primaryDestination ?? '').trim()) ||
    Boolean(String(next.destination ?? '').trim() && next.destination !== '미지정')
  if (!hasDest) {
    const resolved = resolveHanatourRegisterDestination({
      title: String(next.title ?? saleTitle),
      travelCitiesRaw: String(info.smplSchdCont ?? '').trim() || null,
    })
    if (resolved.destination && resolved.destination !== '미지정') {
      next = {
        ...next,
        destination: resolved.destination,
        primaryDestination: resolved.primaryDestination,
        ...(resolved.destinationRaw ? { destinationRaw: resolved.destinationRaw } : {}),
      }
    }
  }
  return next
}

export async function augmentHanatourParsedWithDetailCollect(
  parsed: RegisterParsed,
  ctx?: HanatourRegisterDetailAugmentCtx,
): Promise<RegisterParsed> {
  const originUrl = (ctx?.originUrl ?? '').trim()
  const airHotelListing = isRegisterAirHotelListing(ctx?.travelScope, parsed.productType)
  if (!originUrl || !parseHanatourPkgCdFromUrl(originUrl)) return parsed

  const needSchedule = needsHanatourScheduleCollect(parsed)
  const needInclExcl = needsHanatourIncludedExcludedCollect(parsed)
  const needMustKnow = needsHanatourMustKnowCollect(parsed)
  const needOpt = needsHanatourOptionalCollect({
    hasOptionalPaste: hasOptionalPaste(ctx),
    optionalToursStructured: parsed.optionalToursStructured,
  })
  const needShop = needsRegisterShoppingCollect({
    hasShoppingPaste: hasShoppingPaste(ctx),
    shoppingStops: parsed.shoppingStops,
  })
  const needFlight = needsRegisterFlightApiCollect(parsed)

  if (!needSchedule && !needInclExcl && !needMustKnow && !needOpt && !needShop && !needFlight) {
    return await ensureHanatourRegisterScheduleImageKeywords(parsed, { travelScope: ctx?.travelScope })
  }

  const bundle = await fetchHanatourRegisterDetailBundle(originUrl)
  if (!bundle?.prodInfo) {
    return {
      ...parsed,
      hanatourDetailCollectRan: false,
      hanatourDetailCollectSummary: '자동수집 스킵: getPkgProdInfo 응답 없음',
    }
  }

  const summaryParts: string[] = []
  const { prodInfo, itnr, chcStsng } = bundle
  let next: RegisterParsed = applyHanatourProdInfoIdentityFields(parsed, prodInfo)

  if (needSchedule) {
    const factDays = applyHanatourProdInfoHotelsToFactDays(hanatourItnrToFactDays(itnr), prodInfo)
    const rawTitle = String(next.title ?? prodInfo.saleProdNm ?? '').trim()
    const polished2030 = polishHanatour2030RegisterBundle({
      productTitle: rawTitle,
      factDays,
      schedule: hanatourFactDaysToRegisterSchedule(factDays),
      listingTitle: next.title ?? undefined,
    })
    if (polished2030.listingTitle !== next.title) {
      next = { ...next, title: polished2030.listingTitle }
    }
    const scheduleDays = polished2030.schedule
    if (scheduleDays.length > 0) {
      const withKeywords = airHotelListing
        ? scheduleDays
        : applyRegisterScheduleImageKeywordsBySupplier(scheduleDays, {
            supplierKey: 'hanatour',
            productDestination: next.primaryDestination ?? next.destination ?? null,
            productTitle: next.title ?? null,
            productType: next.productType ?? null,
            optionalTourNames: hanatourOptionalTourNamesFromParsed(next),
            scheduleSectionByDay: next.detailBodyStructured
              ? gatherHanatourScheduleSectionBodiesByDay(next.detailBodyStructured)
              : null,
          })
      next = { ...next, schedule: withKeywords }
      summaryParts.push(`일정 ${withKeywords.length}일차`)
    }
  }

  if (needInclExcl || needMustKnow) {
    next = applyProdInfoFields(next, prodInfo, summaryParts)
  }

  if (needOpt) {
    const optRows = extractHanatourOptionalTours({ itnr, chcStsng: bundle.chcStsng })
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

  if (needFlight) {
    const flightStructured = buildHanatourFlightStructuredFromProdInfo(prodInfo)
    next = applyRegisterCollectedFlightStructured(next, flightStructured)
    if (
      flightStructured &&
      next.detailBodyStructured &&
      Array.isArray(next.detailBodyStructured.sections)
    ) {
      next = {
        ...next,
        detailBodyStructured: refreshHanatourDetailBodyPolicy({
          ...next.detailBodyStructured,
          flightStructured,
        }),
      }
      // REGRESSION-FREEZE[hanatour-register-samples-live-gate]: pkgAirSeqList 후 extractionFieldIssues 재동기화 — manifest
      next = reconcileHanatourExtractionFieldIssuesAfterDetailBodyPatch(next)
    }
    if (flightStructured) summaryParts.push('항공 pkgAirSeqList')
  }

  const notes = [...(next.registerPreviewPolicyNotes ?? [])]
  const note =
    summaryParts.length > 0
      ? `하나투어 상세카드 자동수집: ${summaryParts.join(' · ')} (gw getPkgProdInfo+itnr+chcStsng)`
      : '하나투어 상세카드 자동수집: 해당 축 데이터 없음(originUrl·API 확인)'
  if (!notes.includes(note)) notes.push(note)

  return await ensureHanatourRegisterScheduleImageKeywords(
    {
      ...next,
      hanatourDetailCollectRan: summaryParts.length > 0,
      hanatourDetailCollectSummary: summaryParts.join(' · ') || '스킵 또는 0건',
      registerPreviewPolicyNotes: notes,
    },
    { travelScope: ctx?.travelScope },
  )
}
