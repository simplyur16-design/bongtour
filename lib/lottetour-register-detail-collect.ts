/**
 * 롯데관광 등록 — evtDetailBasicAjax·coreInfo·scheduleAjax·spotListAjax 상세카드 자동 수집.
 * 붙여넣기·LLM·정형칸 SSOT가 있으면 덮지 않음.
 *
 * REGRESSION-FREEZE[lottetour-register-detail-collect]: augmentLottetourParsedWithDetailCollect — manifest
 */
import type { RegisterParsed } from '@/lib/register-llm-schema-lottetour'
import type { RegisterPastedBlocksInput } from '@/lib/register-llm-blocks-lottetour'
import {
  extractLottetourFeesFromExcluded,
  extractLottetourIncludedExcludedFromBasicAjax,
  extractLottetourMeetingFromScheduleAjax,
  extractLottetourMustKnowFromBasicAjax,
  extractLottetourOptionalFromSpotListAjax,
  extractLottetourShoppingVisitCountFromCoreInfo,
  fetchLottetourRegisterDetailBundle,
  lottetourCalendarRowToFlightStructured,
  lottetourHaystackDeclaresNoOptional,
  lottetourOptionalRowsToStructuredJson,
  parseLottetourScheduleDaysFromScheduleAjax,
} from '@/lib/lottetour-register-api-detail'
import { finalizeLottetourRegisterParsedShopping } from '@/lib/register-lottetour-shopping'
import { extractLottetourMasterIdsFromBlob } from '@/lib/lottetour-paste-deterministic-patch'

export type LottetourRegisterDetailAugmentCtx = {
  originUrl?: string | null
  pastedBlocks?: Partial<Pick<RegisterPastedBlocksInput, 'shopping' | 'optionalTour'>> | null
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

function hasOptionalPaste(ctx?: LottetourRegisterDetailAugmentCtx): boolean {
  return Boolean(ctx?.pastedBlocks?.optionalTour?.trim())
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

export function needsLottetourScheduleCollect(parsed: RegisterParsed): boolean {
  const rows = parsed.schedule ?? []
  if (rows.length === 0) return true
  return rows.every((d) => !d.title?.trim() && !d.description?.trim())
}

export function needsLottetourIncludedExcludedCollect(parsed: RegisterParsed): boolean {
  const hasIncl = (parsed.includedItems?.length ?? 0) > 0 || Boolean(parsed.includedText?.trim())
  const hasExcl = (parsed.excludedItems?.length ?? 0) > 0 || Boolean(parsed.excludedText?.trim())
  return !hasIncl && !hasExcl
}

export function needsLottetourMustKnowCollect(parsed: RegisterParsed): boolean {
  return (parsed.mustKnowItems?.length ?? 0) === 0 && !parsed.mustKnowRaw?.trim()
}

function needsLottetourFlightCollect(parsed: RegisterParsed): boolean {
  const fs = parsed.detailBodyStructured?.flightStructured
  const hasFlat =
    Boolean(parsed.airlineName?.trim()) ||
    Boolean(parsed.outboundFlightNo?.trim()) ||
    Boolean(parsed.departureSegmentText?.trim())
  const hasStructured =
    Boolean(fs?.outbound?.flightNo?.trim()) ||
    Boolean(fs?.outbound?.departureTime?.trim()) ||
    fs?.debug?.status === 'success' ||
    fs?.debug?.status === 'partial'
  return !hasFlat && !hasStructured
}

function needsLottetourMeetingCollect(parsed: RegisterParsed): boolean {
  return !Boolean(parsed.meetingInfoRaw?.trim() || parsed.meetingPlaceRaw?.trim())
}

function needsLottetourOptionalCollect(parsed: RegisterParsed, ctx?: LottetourRegisterDetailAugmentCtx): boolean {
  if (hasOptionalPaste(ctx) || hasStructuredOptional(parsed)) return false
  const titleHay = [parsed.title, parsed.supplierListingTitleRaw].filter(Boolean).join(' ')
  if (lottetourHaystackDeclaresNoOptional(titleHay)) return false
  return parsed.hasOptionalTour !== false && (parsed.optionalTourCount ?? 0) === 0
}

export async function augmentLottetourParsedWithDetailCollect(
  parsed: RegisterParsed,
  ctx?: LottetourRegisterDetailAugmentCtx,
): Promise<RegisterParsed> {
  const originUrl = (ctx?.originUrl ?? '').trim()
  if (!originUrl || !extractLottetourMasterIdsFromBlob(originUrl).evtCd) return parsed

  const needSchedule = needsLottetourScheduleCollect(parsed)
  const needInclExcl = needsLottetourIncludedExcludedCollect(parsed)
  const needMustKnow = needsLottetourMustKnowCollect(parsed)
  const needFlight = needsLottetourFlightCollect(parsed)
  const needMeeting = needsLottetourMeetingCollect(parsed)
  const needOpt = needsLottetourOptionalCollect(parsed, ctx)
  const needShop =
    !Boolean(ctx?.pastedBlocks?.shopping?.trim()) &&
    !hasStructuredShopping(parsed) &&
    parsed.shoppingVisitCount == null

  if (!needSchedule && !needInclExcl && !needMustKnow && !needFlight && !needMeeting && !needOpt && !needShop) {
    return parsed
  }

  const bundle = await fetchLottetourRegisterDetailBundle(originUrl)
  if (
    !bundle?.basicAjaxHtml &&
    !bundle?.coreInfoHtml &&
    !bundle?.evtListRow &&
    !bundle?.scheduleAjaxHtml &&
    !bundle?.spotListAjaxHtml
  ) {
    return {
      ...parsed,
      lottetourDetailCollectRan: false,
      lottetourDetailCollectSummary: '자동수집 스킵: basicAjax·schedule·spotList 응답 없음',
    }
  }

  const summaryParts: string[] = []
  let next: RegisterParsed = { ...parsed }
  const { basicAjaxHtml, coreInfoHtml, evtListRow, scheduleAjaxHtml, spotListAjaxHtml } = bundle

  if (needSchedule && scheduleAjaxHtml) {
    const scheduleDays = parseLottetourScheduleDaysFromScheduleAjax(scheduleAjaxHtml)
    if (scheduleDays.length > 0) {
      next = { ...next, schedule: scheduleDays }
      summaryParts.push(`일정 ${scheduleDays.length}일차`)
    }
  }

  if (needMeeting && scheduleAjaxHtml) {
    const meeting = extractLottetourMeetingFromScheduleAjax(scheduleAjaxHtml)
    if (meeting.meetingInfoRaw) {
      next = {
        ...next,
        meetingPlaceRaw: meeting.meetingPlaceRaw,
        meetingInfoRaw: meeting.meetingInfoRaw,
        meetingNoticeRaw: meeting.meetingNoticeRaw,
      }
      summaryParts.push('미팅/집결')
    }
  }

  if (needInclExcl && basicAjaxHtml) {
    const { includedItems, excludedItems } = extractLottetourIncludedExcludedFromBasicAjax(basicAjaxHtml)
    if (includedItems.length > 0) {
      next = {
        ...next,
        includedItems,
        includedText: includedItems.join('\n'),
        includedRaw: includedItems.join('\n'),
      }
    }
    if (excludedItems.length > 0) {
      const fees = extractLottetourFeesFromExcluded(excludedItems)
      const exclWithFees = [...excludedItems]
      if (fees.singleRoomSurchargeRaw && !exclWithFees.some((x) => /싱글|써차지/i.test(x))) {
        exclWithFees.push(fees.singleRoomSurchargeRaw)
      }
      next = {
        ...next,
        excludedItems: exclWithFees,
        excludedText: exclWithFees.join('\n'),
        excludedRaw: exclWithFees.join('\n'),
      }
      summaryParts.push(`포함 ${includedItems.length}·불포함 ${exclWithFees.length}`)
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
    } else if (includedItems.length > 0) {
      summaryParts.push(`포함 ${includedItems.length}건`)
    }
  }

  if (needMustKnow && basicAjaxHtml) {
    const bullets = extractLottetourMustKnowFromBasicAjax(basicAjaxHtml)
    if (bullets.length > 0) {
      next = {
        ...next,
        mustKnowItems: bullets.map((body) => ({
          category: '국내준비' as const,
          title: body.slice(0, 60),
          body,
          raw: body,
        })),
        mustKnowSource: 'supplier',
      }
      summaryParts.push(`유의사항 ${bullets.length}건`)
    }
  }

  if (needFlight && evtListRow) {
    const flightStructured = lottetourCalendarRowToFlightStructured(evtListRow)
    if (flightStructured) {
      next = {
        ...next,
        airlineName: flightStructured.airlineName ?? next.airlineName,
        departureSegmentText: evtListRow.departTimeText ?? next.departureSegmentText,
        returnSegmentText: evtListRow.returnTimeText ?? next.returnSegmentText,
        ...(next.detailBodyStructured
          ? { detailBodyStructured: { ...next.detailBodyStructured, flightStructured } }
          : {}),
      }
      summaryParts.push('교통편 힌트')
    }
  }

  if (needOpt && spotListAjaxHtml) {
    const optRows = extractLottetourOptionalFromSpotListAjax(spotListAjaxHtml)
    if (optRows.length > 0) {
      next = {
        ...next,
        optionalToursStructured: lottetourOptionalRowsToStructuredJson(optRows),
        optionalTourCount: optRows.length,
        hasOptionalTour: true,
        optionalTourSummaryText:
          optRows.length > 1 ? `현지옵션 ${optRows.length}개` : '현지옵션 있음',
      }
      summaryParts.push(`선택관광 ${optRows.length}건`)
    }
  }

  if (needShop) {
    const visitCount = extractLottetourShoppingVisitCountFromCoreInfo(coreInfoHtml)
    if (visitCount != null) {
      next = {
        ...next,
        shoppingVisitCount: visitCount,
        hasShopping: visitCount > 0,
        shoppingSummaryText: visitCount > 0 ? `쇼핑 ${visitCount}회` : '쇼핑 없음',
      }
      summaryParts.push(`쇼핑 ${visitCount}회`)
      next = finalizeLottetourRegisterParsedShopping(next)
    }
  }

  const notes = [...(next.registerPreviewPolicyNotes ?? [])]
  const note =
    summaryParts.length > 0
      ? `롯데관광 상세카드 자동수집: ${summaryParts.join(' · ')} (basicAjax+scheduleAjax+spotList)`
      : '롯데관광 상세카드 자동수집: 해당 축 데이터 없음(붙여넣기·LLM 우선)'
  if (!notes.includes(note)) notes.push(note)

  return {
    ...next,
    lottetourDetailCollectRan: summaryParts.length > 0,
    lottetourDetailCollectSummary: summaryParts.join(' · ') || '스킵 또는 0건',
    registerPreviewPolicyNotes: notes,
  }
}
