/**
 * 롯데관광 등록 — evtDetailBasicAjax·coreInfo·scheduleAjax·spotListAjax 상세카드 자동 수집.
 * 붙여넣기·LLM·정형칸 SSOT가 있으면 덮지 않음.
 *
 * REGRESSION-FREEZE[lottetour-register-detail-collect]: augmentLottetourParsedWithDetailCollect — manifest
 */
import type { RegisterParsed } from '@/lib/register-llm-schema-lottetour'
import type { OptionalToursStructured, ShoppingStructured } from '@/lib/detail-body-parser-types'
import type { OptionalTourRowFields } from '@/lib/optional-tour-row-gate-lottetour'
import type { RegisterPastedBlocksInput } from '@/lib/register-llm-blocks-lottetour'
import {
  extractLottetourFeesFromExcluded,
  extractLottetourIncludedExcludedFromBasicAjax,
  extractLottetourMeetingFromScheduleAjax,
  extractLottetourMustKnowFromBasicAjax,
  extractLottetourOptionalFromSpotListAjax,
  extractLottetourShoppingFromSpotListAjax,
  extractLottetourShoppingVisitCountFromCoreInfo,
  extractLottetourShoppingVisitCountFromSpotList,
  buildLottetourFlightStructuredFromRegisterSources,
  fetchLottetourRegisterDetailBundle,
  lottetourHaystackDeclaresNoOptional,
  lottetourOptionalRowsToStructuredJson,
  lottetourShoppingRowsToStructuredJson,
  parseLottetourScheduleDaysFromScheduleAjax,
} from '@/lib/lottetour-register-api-detail'
import { finalizeLottetourRegisterParsedShopping } from '@/lib/register-lottetour-shopping'
import { extractLottetourMasterIdsFromBlob } from '@/lib/lottetour-paste-deterministic-patch'
import {
  applyRegisterCollectedFlightStructured,
  needsRegisterFlightApiCollect,
} from '@/lib/register-detail-collect-flight-apply'
import { applyAugmentScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-augment-image-keywords'

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

function lottetourApiOptionalToDetailBodyRows(
  rows: OptionalTourRowFields[],
): OptionalToursStructured['rows'] {
  return rows.map((r) => ({
    tourName: r.name,
    currency: r.currency ?? '',
    adultPrice: r.adultPrice ?? null,
    childPrice: r.childPrice ?? null,
    durationText: r.durationText ?? '',
    minPeopleText: r.minPaxText ?? '',
    guide同行Text: r.guide同行Text ?? '',
    waitingPlaceText: r.waitingPlaceText ?? '',
    descriptionText: r.alternateScheduleText ?? '',
    priceText: r.priceText ?? undefined,
    alternateScheduleText: r.alternateScheduleText ?? undefined,
  }))
}

function lottetourApiShoppingToDetailBodyRows(
  rows: ReturnType<typeof extractLottetourShoppingFromSpotListAjax>['rows'],
): ShoppingStructured['rows'] {
  return rows.map((r) => ({
    shoppingItem: r.itemType,
    shoppingPlace: r.placeName,
    durationText: r.durationText ?? '',
    refundPolicyText: r.refundPolicyText ?? '',
    visitNo: r.visitNo,
    candidateOnly: false as const,
  }))
}

export function needsLottetourScheduleCollect(parsed: RegisterParsed): boolean {
  const rows = parsed.schedule ?? []
  if (rows.length === 0) return true
  return rows.every((d) => !d.title?.trim() && !d.description?.trim())
}

function substantiveBulletItems(items?: string[] | null): string[] {
  return (items ?? []).map((x) => String(x).trim()).filter((x) => x.length > 2)
}

export function needsLottetourIncludedCollect(parsed: RegisterParsed): boolean {
  return substantiveBulletItems(parsed.includedItems).length === 0 && !parsed.includedText?.trim()
}

export function needsLottetourExcludedCollect(parsed: RegisterParsed): boolean {
  return substantiveBulletItems(parsed.excludedItems).length === 0 && !parsed.excludedText?.trim()
}

export function needsLottetourIncludedExcludedCollect(parsed: RegisterParsed): boolean {
  return needsLottetourIncludedCollect(parsed) || needsLottetourExcludedCollect(parsed)
}

export function needsLottetourMustKnowCollect(parsed: RegisterParsed): boolean {
  return (parsed.mustKnowItems?.length ?? 0) === 0 && !parsed.mustKnowRaw?.trim()
}

function needsLottetourFlightCollect(parsed: RegisterParsed): boolean {
  return needsRegisterFlightApiCollect(parsed)
}

function needsLottetourMeetingCollect(parsed: RegisterParsed): boolean {
  return !Boolean(parsed.meetingInfoRaw?.trim() || parsed.meetingPlaceRaw?.trim())
}

/** 롯데관광 — LLM hasOptionalTour=false여도 spotList 수집 시도 */
export function needsLottetourOptionalCollect(args: {
  hasOptionalPaste: boolean
  optionalToursStructured: string | null | undefined
  declaresNoOptional?: boolean
}): boolean {
  if (args.hasOptionalPaste || hasStructuredOptionalFromRaw(args.optionalToursStructured)) return false
  if (args.declaresNoOptional) return false
  return true
}

function hasStructuredOptionalFromRaw(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return false
  try {
    const arr = JSON.parse(raw) as unknown
    return Array.isArray(arr) && arr.length > 0
  } catch {
    return false
  }
}

function needsLottetourOptionalCollectInternal(
  parsed: RegisterParsed,
  ctx?: LottetourRegisterDetailAugmentCtx,
): boolean {
  const titleHay = [parsed.title, parsed.supplierListingTitleRaw].filter(Boolean).join(' ')
  return needsLottetourOptionalCollect({
    hasOptionalPaste: hasOptionalPaste(ctx),
    optionalToursStructured: parsed.optionalToursStructured,
    declaresNoOptional: lottetourHaystackDeclaresNoOptional(titleHay),
  })
}

export async function augmentLottetourParsedWithDetailCollect(
  parsed: RegisterParsed,
  ctx?: LottetourRegisterDetailAugmentCtx,
): Promise<RegisterParsed> {
  const originUrl = (ctx?.originUrl ?? '').trim()
  if (!originUrl || !extractLottetourMasterIdsFromBlob(originUrl).evtCd) return parsed

  const needSchedule = needsLottetourScheduleCollect(parsed)
  const needIncl = needsLottetourIncludedCollect(parsed)
  const needExcl = needsLottetourExcludedCollect(parsed)
  const needMustKnow = needsLottetourMustKnowCollect(parsed)
  const needFlight = needsLottetourFlightCollect(parsed)
  const needMeeting = needsLottetourMeetingCollect(parsed)
  const needOpt = needsLottetourOptionalCollectInternal(parsed, ctx)
  const needShop =
    !Boolean(ctx?.pastedBlocks?.shopping?.trim()) && !hasStructuredShopping(parsed)

  if (
    !needSchedule &&
    !needIncl &&
    !needExcl &&
    !needMustKnow &&
    !needFlight &&
    !needMeeting &&
    !needOpt &&
    !needShop
  ) {
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
      next = {
        ...next,
        schedule: applyAugmentScheduleImageKeywordsBySupplier(scheduleDays, {
          supplierKey: 'lottetour',
          productTitle: next.title ?? next.supplierListingTitleRaw ?? '',
        }),
      }
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

  if ((needIncl || needExcl) && basicAjaxHtml) {
    const { includedItems, excludedItems } = extractLottetourIncludedExcludedFromBasicAjax(basicAjaxHtml)
    if (needIncl && includedItems.length > 0) {
      next = {
        ...next,
        includedItems,
        includedText: includedItems.join('\n'),
        includedRaw: includedItems.join('\n'),
      }
    }
    if (needExcl && excludedItems.length > 0) {
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
    const inclN = next.includedItems?.length ?? 0
    const exclN = next.excludedItems?.length ?? 0
    if (inclN > 0 || exclN > 0) {
      summaryParts.push(`포함 ${inclN}·불포함 ${exclN}`)
    }
    if (next.detailBodyStructured) {
      const ie = next.detailBodyStructured.includedExcludedStructured
      next = {
        ...next,
        detailBodyStructured: {
          ...next.detailBodyStructured,
          includedExcludedStructured: {
            ...ie,
            includedItems: next.includedItems ?? ie.includedItems ?? [],
            excludedItems: next.excludedItems ?? ie.excludedItems ?? [],
            noteText: ie?.noteText ?? '',
            reviewNeeded: ie?.reviewNeeded ?? false,
            reviewReasons: ie?.reviewReasons ?? [],
          },
        },
      }
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

  if (needFlight && (scheduleAjaxHtml || evtListRow)) {
    const flightStructured = buildLottetourFlightStructuredFromRegisterSources({
      scheduleAjaxHtml,
      evtListRow,
    })
    next = applyRegisterCollectedFlightStructured(next, flightStructured)
    if (flightStructured) {
      next = {
        ...next,
        departureSegmentText: evtListRow?.departTimeText ?? next.departureSegmentText,
        returnSegmentText: evtListRow?.returnTimeText ?? next.returnSegmentText,
      }
      summaryParts.push('교통편 scheduleAjax+evtList')
    }
  }

  if (needOpt && spotListAjaxHtml) {
    const optRows = extractLottetourOptionalFromSpotListAjax(spotListAjaxHtml)
    if (optRows.length > 0) {
      const optJson = lottetourOptionalRowsToStructuredJson(optRows)
      next = {
        ...next,
        optionalToursStructured: optJson,
        optionalTourCount: optRows.length,
        hasOptionalTour: true,
        optionalTourSummaryText:
          optRows.length > 1 ? `현지옵션 ${optRows.length}개` : '현지옵션 있음',
      }
      if (next.detailBodyStructured) {
        next = {
          ...next,
          detailBodyStructured: {
            ...next.detailBodyStructured,
            optionalToursStructured: {
              rows: lottetourApiOptionalToDetailBodyRows(optRows),
              reviewNeeded: false,
              reviewReasons: [],
            },
          },
        }
      }
      summaryParts.push(`선택관광 ${optRows.length}건`)
    }
  }

  if (needShop && spotListAjaxHtml) {
    const shop = extractLottetourShoppingFromSpotListAjax(spotListAjaxHtml)
    const visitCount =
      shop.visitCount ??
      extractLottetourShoppingVisitCountFromSpotList(spotListAjaxHtml) ??
      extractLottetourShoppingVisitCountFromCoreInfo(coreInfoHtml)
    if (shop.rows.length > 0) {
      next = {
        ...next,
        shoppingStops: lottetourShoppingRowsToStructuredJson(shop.rows),
        shoppingVisitCount: visitCount ?? shop.rows.length,
        hasShopping: true,
        shoppingSummaryText:
          visitCount != null && visitCount > 0 ? `쇼핑 ${visitCount}회` : `쇼핑 ${shop.rows.length}회`,
      }
      summaryParts.push(`쇼핑 ${shop.rows.length}행`)
      if (next.detailBodyStructured) {
        const shoppingCountText =
          visitCount != null && visitCount > 0 ? `쇼핑 ${visitCount}회` : `쇼핑 ${shop.rows.length}회`
        next = {
          ...next,
          detailBodyStructured: {
            ...next.detailBodyStructured,
            shoppingStructured: {
              rows: lottetourApiShoppingToDetailBodyRows(shop.rows),
              shoppingCountText,
              reviewNeeded: false,
              reviewReasons: [],
            },
          },
        }
      }
      next = finalizeLottetourRegisterParsedShopping(next)
    } else if (visitCount != null) {
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

  if (
    (next.schedule?.length ?? 0) > 0 &&
    next.schedule!.some((d) => !d.imageKeyword2?.trim())
  ) {
    next = {
      ...next,
      schedule: applyAugmentScheduleImageKeywordsBySupplier(next.schedule ?? [], {
        supplierKey: 'lottetour',
        productTitle: next.title ?? next.supplierListingTitleRaw ?? '',
      }),
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
