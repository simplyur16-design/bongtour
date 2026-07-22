/**
 * ybtour 등록 — papi로 상세카드 축 자동 수집.
 * 붙여넣기·LLM·정형칸 SSOT가 있으면 덮지 않음.
 *
 * REGRESSION-FREEZE[ybtour-register-detail-collect]: augmentYbtourParsedWithDetailCollect — manifest
 * REGRESSION-FREEZE[ybtour-register-highlight-corepoints]: goodsInfo → highlightPoints — manifest
 * REGRESSION-FREEZE[ybtour-register-ssot-freeze]: preview=confirm API SSOT — manifest
 * REGRESSION-FREEZE[register-schedule-image-keyword-gemini-fill]: 규칙 후 빈 kw → Gemini — manifest
 * REGRESSION-FREEZE[ybtour-register-schedule-image-keyword-apply]: ensureYbtourRegisterScheduleImageKeywords — manifest
 */
import type { RegisterParsed } from '@/lib/register-llm-schema-ybtour'
import type { RegisterPastedBlocksInput } from '@/lib/register-llm-blocks-ybtour'
import { formatYbtourHighlightPointsFromCorePoints } from '@/lib/extract-highlight-ybtour'
import {
  buildYbtourFlightStructuredFromTm,
  extractYbtourCorePointsFromGoodsInfo,
  extractYbtourFeesFromNotice,
  extractYbtourIncludedExcluded,
  extractYbtourMeetingFromScheduleTm,
  extractYbtourOptionalFromOptionList,
  extractYbtourOptionalFromTourDetail,
  extractYbtourShoppingFromNoticeAndSchedule,
  extractYbtourShoppingFromShopList,
  fetchYbtourRegisterDetailBundle,
  optionalRowsToStructuredJson,
  resolveYbtourCarrierNameForUrl,
  shoppingRowsToStopsJson,
  ybtourScheduleBundleToRegisterSchedule,
} from '@/lib/ybtour-register-api-detail'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { isRegisterAirHotelListing } from '@/lib/register-admin-airtel-listing'
import { applyYbtourScheduleExpressionToRows } from '@/lib/ybtour-register-api-schedule'
import { finalizeYbtourRegisterParsedShopping } from '@/lib/register-ybtour-shopping'
import { parseYbtourEvCdFromUrl, parseYbtourGoodsCdFromUrl } from '@/lib/ybtour-api-departures'
import {
  ybtourHaystackDeclaresNoOptional,
  ybtourHaystackDeclaresNoShopping,
} from '@/lib/register-ybtour-shopping'
import {
  hasStructuredJsonRows,
  needsRegisterExcludedCollect,
  needsRegisterIncludedCollect,
  needsRegisterIncludedExcludedCollect,
  needsRegisterShoppingCollect,
} from '@/lib/register-detail-collect-gates'
import { collectYbtourRegisterFacts } from '@/lib/register-facts/ybtour'
import { resolveYbtourRegisterDestination } from '@/lib/ybtour-register-destination-from-paste'
import {
  applyRegisterCollectedFlightStructured,
  needsRegisterFlightApiCollect,
} from '@/lib/register-detail-collect-flight-apply'

export type YbtourRegisterDetailAugmentCtx = {
  originUrl?: string | null
  pastedBlocks?: Partial<Pick<RegisterPastedBlocksInput, 'optionalTour' | 'shopping'>> | null
  travelScope?: string | null
}

function hasOptionalPaste(ctx?: YbtourRegisterDetailAugmentCtx): boolean {
  return Boolean(ctx?.pastedBlocks?.optionalTour?.trim())
}

function hasShoppingPaste(ctx?: YbtourRegisterDetailAugmentCtx): boolean {
  return Boolean(ctx?.pastedBlocks?.shopping?.trim())
}

function hasStructuredOptional(parsed: RegisterParsed): boolean {
  return hasStructuredJsonRows(parsed.optionalToursStructured)
}

function hasStructuredShopping(parsed: RegisterParsed): boolean {
  return hasStructuredJsonRows(parsed.shoppingStops)
}

async function applyYbtourIdentityFromRegisterFacts(
  parsed: RegisterParsed,
  originUrl: string,
): Promise<RegisterParsed> {
  const hasTitle = Boolean(String(parsed.title ?? '').trim() && parsed.title !== '미지정')
  const hasDest =
    Boolean(String(parsed.primaryDestination ?? '').trim()) ||
    Boolean(String(parsed.destination ?? '').trim() && parsed.destination !== '미지정')
  if (hasTitle && hasDest) return parsed
  const facts = await collectYbtourRegisterFacts(originUrl)
  if (!facts) return parsed
  let next = parsed
  const listingTitle = String(facts.title ?? '').trim()
  if (!hasTitle && listingTitle) {
    next = { ...next, title: listingTitle, supplierListingTitleRaw: listingTitle }
  }
  if (!hasDest) {
    const resolved = resolveYbtourRegisterDestination({
      title: String(next.title ?? listingTitle),
      pastedBody: null,
      llmDestination: null,
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

export function needsYbtourIncludedCollect(parsed: RegisterParsed): boolean {
  return needsRegisterIncludedCollect(parsed)
}

export function needsYbtourExcludedCollect(parsed: RegisterParsed): boolean {
  return needsRegisterExcludedCollect(parsed)
}

export function needsYbtourIncludedExcludedCollect(parsed: RegisterParsed): boolean {
  return needsRegisterIncludedExcludedCollect(parsed)
}

export function needsYbtourScheduleCollect(parsed: RegisterParsed): boolean {
  const rows = parsed.schedule ?? []
  if (rows.length === 0) return true
  if (rows.every((d) => !d.title?.trim() && !d.description?.trim())) return true
  return rows.some((d) => !String(d.routeText ?? '').trim())
}

export function needsYbtourMustKnowCollect(parsed: RegisterParsed): boolean {
  return (parsed.mustKnowItems?.length ?? 0) === 0 && !parsed.mustKnowRaw?.trim()
}

/** API·붙여넣기 schedule — routeText 슬롯 규칙만. Gemini는 post-augment 1회.
 * REGRESSION-FREEZE[ybtour-register-schedule-image-keyword-apply]
 * REGRESSION-FREEZE[register-schedule-image-keyword-gemini-fill]: rules-only ensure — manifest
 */
export async function ensureYbtourRegisterScheduleImageKeywords(
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
    supplierKey: 'ybtour',
    productDestination: parsed.primaryDestination ?? parsed.destination ?? null,
    productTitle: parsed.title ?? null,
  })
  const merged = withKeywords.map((row, i) => {
    const prev = normalized[i]
    const keep1 = String(prev?.imageKeyword ?? '').trim()
    const keep2 = String(prev?.imageKeyword2 ?? '').trim()
    return {
      ...row,
      imageKeyword: keep1 || String(row.imageKeyword ?? '').trim(),
      imageKeyword2: keep2 || row.imageKeyword2 || null,
    }
  })
  return { ...parsed, schedule: merged }
}

function needsYbtourMeetingCollect(parsed: RegisterParsed): boolean {
  return (
    !parsed.meetingInfoRaw?.trim() &&
    !parsed.meetingPlaceRaw?.trim() &&
    !parsed.meetingNoticeRaw?.trim()
  )
}

/** ybtour — LLM hasOptionalTour=false여도 tour-detail papi 수집 시도 */
export function needsYbtourOptionalCollect(args: {
  hasOptionalPaste: boolean
  optionalToursStructured: string | null | undefined
  declaresNoOptional?: boolean
}): boolean {
  if (args.hasOptionalPaste || hasStructuredJsonRows(args.optionalToursStructured)) return false
  if (args.declaresNoOptional) return false
  return true
}

export async function augmentYbtourParsedWithDetailCollect(
  parsed: RegisterParsed,
  ctx?: YbtourRegisterDetailAugmentCtx,
): Promise<RegisterParsed> {
  if (parsed.ybtourDetailCollectRan) return parsed
  const originUrl = (ctx?.originUrl ?? '').trim()
  const airHotelListing = isRegisterAirHotelListing(ctx?.travelScope, parsed.productType)
  if (!originUrl || (!parseYbtourEvCdFromUrl(originUrl) && !parseYbtourGoodsCdFromUrl(originUrl))) {
    return parsed
  }

  let parsedWithIdentity = await applyYbtourIdentityFromRegisterFacts(parsed, originUrl)

  const titleHay = [parsedWithIdentity.title, parsedWithIdentity.supplierListingTitleRaw].filter(Boolean).join(' ')
  const needSchedule = needsYbtourScheduleCollect(parsedWithIdentity)
  const needIncl = needsYbtourIncludedCollect(parsedWithIdentity)
  const needExcl = needsYbtourExcludedCollect(parsedWithIdentity)
  const needInclExcl = needIncl || needExcl
  const needMustKnow = needsYbtourMustKnowCollect(parsedWithIdentity)
  const needMeeting = needsYbtourMeetingCollect(parsedWithIdentity)
  const needFlight = needsRegisterFlightApiCollect(parsedWithIdentity)
  const needOpt = needsYbtourOptionalCollect({
    hasOptionalPaste: hasOptionalPaste(ctx),
    optionalToursStructured: parsedWithIdentity.optionalToursStructured,
    declaresNoOptional: ybtourHaystackDeclaresNoOptional(titleHay),
  })
  const needShop = needsRegisterShoppingCollect({
    hasShoppingPaste: hasShoppingPaste(ctx),
    shoppingStops: parsedWithIdentity.shoppingStops,
  })

  if (
    !needSchedule &&
    !needInclExcl &&
    !needMustKnow &&
    !needMeeting &&
    !needFlight &&
    !needOpt &&
    !needShop
  ) {
    return await ensureYbtourRegisterScheduleImageKeywords(parsedWithIdentity, { travelScope: ctx?.travelScope })
  }

  const bundle = await fetchYbtourRegisterDetailBundle(originUrl, {
    includeOptShop: needOpt || needShop,
  })
  if (!bundle?.notice && !bundle?.schedule && !bundle?.tourDetail && !bundle?.optionalTourDetail) {
    return {
      ...parsedWithIdentity,
      ybtourDetailCollectRan: false,
      ybtourDetailCollectSummary: '자동수집 스킵: papi notice·schedule 응답 없음',
    }
  }

  const summaryParts: string[] = []
  let next: RegisterParsed = { ...parsedWithIdentity }
  const { notice, schedule, tourDetail } = bundle
  const scheduleDetail = schedule?.scheduleDetail ?? []
  const scheduleDetailTm = schedule?.scheduleDetailTm ?? []

  if (needSchedule && scheduleDetail.length + scheduleDetailTm.length > 0) {
    const scheduleDays = applyYbtourScheduleExpressionToRows(
      ybtourScheduleBundleToRegisterSchedule(scheduleDetail, scheduleDetailTm),
    )
    if (scheduleDays.length > 0) {
      const destHint = next.primaryDestination ?? next.destination ?? null
      next = {
        ...next,
        schedule: airHotelListing
          ? scheduleDays
          : applyRegisterScheduleImageKeywordsBySupplier(scheduleDays, {
              supplierKey: 'ybtour',
              productDestination: destHint,
              productTitle: next.title,
            }),
      }
      summaryParts.push(`일정 ${scheduleDays.length}일차`)
    }
  }

  if ((needIncl || needExcl) && notice) {
    const { includedItems, excludedItems } = extractYbtourIncludedExcluded(notice)
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
    const fees = extractYbtourFeesFromNotice(notice)
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
  }

  if (notice) {
    const corePoints = extractYbtourCorePointsFromGoodsInfo(notice)
    if (needMustKnow && corePoints.length > 0) {
      next = {
        ...next,
        mustKnowItems: corePoints.map((body) => ({
          category: '현지준비' as const,
          title: body.slice(0, 60),
          body,
          raw: body,
        })),
        mustKnowSource: 'supplier',
      }
      summaryParts.push(`핵심포인트 ${corePoints.length}건`)
    }
    // REGRESSION-FREEZE[ybtour-register-highlight-corepoints]: when highlight empty, set from goodsInfo
    const highlightEmpty =
      !String(next.highlightPointsRaw ?? '').trim() && !String(next.highlightPoints ?? '').trim()
    if (highlightEmpty) {
      const highlight = formatYbtourHighlightPointsFromCorePoints(corePoints)
      if (highlight) {
        next = {
          ...next,
          highlightPointsRaw: highlight,
          highlightPoints: highlight,
        }
        summaryParts.push('상품핵심포인트')
      }
    }
  }

  if (needMeeting && scheduleDetailTm.length > 0) {
    const meeting = extractYbtourMeetingFromScheduleTm(scheduleDetailTm)
    if (meeting.meetingInfoRaw) {
      next = {
        ...next,
        meetingPlaceRaw: meeting.meetingPlaceRaw,
        meetingInfoRaw: meeting.meetingInfoRaw,
        meetingNoticeRaw: meeting.meetingNoticeRaw,
      }
      summaryParts.push('집결/미팅')
    }
  }

  if (needFlight && scheduleDetailTm.length > 0) {
    const carrierName = await resolveYbtourCarrierNameForUrl(originUrl)
    const flightStructured = buildYbtourFlightStructuredFromTm(scheduleDetailTm, {
      airlineName: carrierName,
    })
    next = applyRegisterCollectedFlightStructured(next, flightStructured)
    if (flightStructured) summaryParts.push('항공 event-schedule')
  }

  if (needOpt) {
    const optFromList = extractYbtourOptionalFromOptionList(bundle.optionalTourDetail?.optionList ?? [])
    const optFromTour =
      tourDetail && tourDetail.length > 0 ? extractYbtourOptionalFromTourDetail(tourDetail) : []
    const optRows = optFromList.length > 0 ? optFromList : optFromTour
    if (!ybtourHaystackDeclaresNoOptional(titleHay) && optRows.length > 0) {
      next = {
        ...next,
        optionalToursStructured: optionalRowsToStructuredJson(optRows),
        optionalTourCount: optRows.length,
        hasOptionalTour: true,
        optionalTourSummaryText:
          optRows.length > 1 ? `현지옵션 ${optRows.length}개` : '현지옵션 있음',
      }
      summaryParts.push(`선택관광 ${optRows.length}건`)
    } else if (optFromList.length > 0 || optFromTour.length > 0 || tourDetail?.length) {
      next = {
        ...next,
        optionalToursStructured: null,
        optionalTourCount: 0,
        hasOptionalTour: false,
        optionalTourSummaryText: '현지옵션 없음',
      }
    }
  }

  if (needShop) {
    const shopFromList = extractYbtourShoppingFromShopList(bundle.optionalTourDetail?.shopList ?? [])
    const shop =
      shopFromList.rows.length > 0
        ? shopFromList
        : extractYbtourShoppingFromNoticeAndSchedule(notice, scheduleDetailTm)
    const declaresNoShop = ybtourHaystackDeclaresNoShopping(titleHay)
    if (!declaresNoShop) {
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
      next = finalizeYbtourRegisterParsedShopping(next)
    } else if (shop.visitCount === 0) {
      next = {
        ...next,
        shoppingVisitCount: 0,
        hasShopping: false,
        shoppingSummaryText: '쇼핑 없음',
      }
    }
  }

  const notes = [...(next.registerPreviewPolicyNotes ?? [])]
  const note =
    summaryParts.length > 0
      ? `ybtour 상세카드 자동수집: ${summaryParts.join(' · ')} (papi notice+event-schedule)`
      : 'ybtour 상세카드 자동수집: 해당 축 데이터 없음(붙여넣기·LLM 우선)'
  if (!notes.includes(note)) notes.push(note)

  return await ensureYbtourRegisterScheduleImageKeywords(
    {
      ...next,
      ybtourDetailCollectRan: summaryParts.length > 0,
      ybtourDetailCollectSummary: summaryParts.join(' · ') || '스킵 또는 0건',
      registerPreviewPolicyNotes: notes,
    },
    { travelScope: ctx?.travelScope },
  )
}
