/**
 * ybtour 등록 — papi로 상세카드 축 자동 수집.
 * 붙여넣기·LLM·정형칸 SSOT가 있으면 덮지 않음.
 *
 * REGRESSION-FREEZE[ybtour-register-detail-collect]: augmentYbtourParsedWithDetailCollect — manifest
 */
import type { RegisterParsed } from '@/lib/register-llm-schema-ybtour'
import type { RegisterPastedBlocksInput } from '@/lib/register-llm-blocks-ybtour'
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
  shoppingRowsToStopsJson,
  ybtourScheduleBundleToRegisterSchedule,
} from '@/lib/ybtour-register-api-detail'
import { finalizeYbtourRegisterParsedShopping } from '@/lib/register-ybtour-shopping'
import { parseYbtourEvCdFromUrl } from '@/lib/ybtour-api-departures'
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

export type YbtourRegisterDetailAugmentCtx = {
  originUrl?: string | null
  pastedBlocks?: Partial<Pick<RegisterPastedBlocksInput, 'optionalTour' | 'shopping'>> | null
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
  return rows.every((d) => !d.title?.trim() && !d.description?.trim())
}

export function needsYbtourMustKnowCollect(parsed: RegisterParsed): boolean {
  return (parsed.mustKnowItems?.length ?? 0) === 0 && !parsed.mustKnowRaw?.trim()
}

function needsYbtourMeetingCollect(parsed: RegisterParsed): boolean {
  return (
    !parsed.meetingInfoRaw?.trim() &&
    !parsed.meetingPlaceRaw?.trim() &&
    !parsed.meetingNoticeRaw?.trim()
  )
}

function needsYbtourFlightCollect(parsed: RegisterParsed): boolean {
  const fs = parsed.detailBodyStructured?.flightStructured
  const hasFlat =
    Boolean(parsed.airlineName?.trim()) ||
    Boolean(parsed.outboundFlightNo?.trim()) ||
    Boolean(parsed.inboundFlightNo?.trim())
  const hasStructured =
    Boolean(fs?.outbound?.flightNo?.trim()) ||
    Boolean(fs?.inbound?.flightNo?.trim()) ||
    fs?.debug?.status === 'success' ||
    fs?.debug?.status === 'partial'
  return !hasFlat && !hasStructured
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
  const originUrl = (ctx?.originUrl ?? '').trim()
  if (!originUrl || !parseYbtourEvCdFromUrl(originUrl)) return parsed

  const titleHay = [parsed.title, parsed.supplierListingTitleRaw].filter(Boolean).join(' ')
  const needSchedule = needsYbtourScheduleCollect(parsed)
  const needIncl = needsYbtourIncludedCollect(parsed)
  const needExcl = needsYbtourExcludedCollect(parsed)
  const needInclExcl = needIncl || needExcl
  const needMustKnow = needsYbtourMustKnowCollect(parsed)
  const needMeeting = needsYbtourMeetingCollect(parsed)
  const needFlight = needsYbtourFlightCollect(parsed)
  const needOpt = needsYbtourOptionalCollect({
    hasOptionalPaste: hasOptionalPaste(ctx),
    optionalToursStructured: parsed.optionalToursStructured,
    declaresNoOptional: ybtourHaystackDeclaresNoOptional(titleHay),
  })
  const needShop = needsRegisterShoppingCollect({
    hasShoppingPaste: hasShoppingPaste(ctx),
    shoppingStops: parsed.shoppingStops,
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
    return parsed
  }

  const bundle = await fetchYbtourRegisterDetailBundle(originUrl, {
    includeOptShop: needOpt || needShop,
  })
  if (!bundle?.notice && !bundle?.schedule && !bundle?.tourDetail && !bundle?.optionalTourDetail) {
    return {
      ...parsed,
      ybtourDetailCollectRan: false,
      ybtourDetailCollectSummary: '자동수집 스킵: papi notice·schedule 응답 없음',
    }
  }

  const summaryParts: string[] = []
  let next: RegisterParsed = { ...parsed }
  const { notice, schedule, tourDetail } = bundle
  const scheduleDetail = schedule?.scheduleDetail ?? []
  const scheduleDetailTm = schedule?.scheduleDetailTm ?? []

  if (needSchedule && scheduleDetail.length + scheduleDetailTm.length > 0) {
    const scheduleDays = ybtourScheduleBundleToRegisterSchedule(scheduleDetail, scheduleDetailTm)
    if (scheduleDays.length > 0) {
      next = { ...next, schedule: scheduleDays }
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

  if (needMustKnow && notice) {
    const corePoints = extractYbtourCorePointsFromGoodsInfo(notice)
    if (corePoints.length > 0) {
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
    const flightStructured = buildYbtourFlightStructuredFromTm(scheduleDetailTm)
    if (flightStructured) {
      const ob = flightStructured.outbound
      const ib = flightStructured.inbound
      next = {
        ...next,
        outboundFlightNo: ob.flightNo ?? next.outboundFlightNo,
        inboundFlightNo: ib.flightNo ?? next.inboundFlightNo,
        departureDateTimeRaw:
          ob.departureDate && ob.departureTime
            ? `${ob.departureDate} ${ob.departureTime}`
            : next.departureDateTimeRaw,
        arrivalDateTimeRaw:
          ib.arrivalDate && ib.arrivalTime
            ? `${ib.arrivalDate} ${ib.arrivalTime}`
            : next.arrivalDateTimeRaw,
        ...(next.detailBodyStructured
          ? {
              detailBodyStructured: {
                ...next.detailBodyStructured,
                flightStructured,
              },
            }
          : {}),
      }
      summaryParts.push('항공 구조')
    }
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

  return {
    ...next,
    ybtourDetailCollectRan: summaryParts.length > 0,
    ybtourDetailCollectSummary: summaryParts.join(' · ') || '스킵 또는 0건',
    registerPreviewPolicyNotes: notes,
  }
}
