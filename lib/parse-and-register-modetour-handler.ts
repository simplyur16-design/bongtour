import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import {
  stripRegisterInternalArtifacts,
  type RegisterExtractionFieldIssue,
  type RegisterParsed,
} from '@/lib/register-llm-schema-modetour'
import { parseForRegisterModetour } from '@/lib/register-parse-modetour'
import { testGeminiConnection } from '@/lib/gemini-client'
import { upsertProductDepartures, type DepartureInput } from '@/lib/upsert-product-departures-modetour'
import { toDeparturePreviewRows } from '@/lib/departure-preview'
import { stripCounselingTermsFromItineraryDayDraft } from '@/lib/itinerary-counseling-terms-strip'
import { extractModetourMealSummaryFromScheduleDescription } from '@/lib/register-modetour-meal-from-description'
import { supplementModetourScheduleFromPastedBody } from '@/lib/register-modetour-pasted-schedule'
import { upsertItineraryDays, registerScheduleToDayInputs } from '@/lib/upsert-itinerary-days-modetour'
import { normalizeOriginSource } from '@/lib/supplier-origin'
import {
  buildPricePromotionFieldIssues,
  mergePricePromotionLayers,
  mergeProductRawMetaPricePromotion,
  parsePricePromotionFromGeminiJson,
  PRICE_PROMOTION_CONSULTING_DISCLAIMER,
  reconcilePromotionSalePriceWithAuthoritative,
  type PricePromotionFieldIssue,
} from '@/lib/price-promotion-modetour'
import { issuePreviewToken, verifyPreviewToken } from '@/lib/registration-preview-token'
import {
  computeModetourLinkedDeparturePrices,
  finalizeModetourRegisterParsedPricing,
  lastModetourDeparturePricingSample,
  lastModetourPriceClassificationTrace,
  modetourConfirmSaveGateStrict,
  modetourDepartureInputsSubstantive,
  modetourDepartureInputsToProductPriceCreateMany,
  modetourItineraryDayDraftsSubstantive,
  modetourParsedCalendarRowsToProductPriceCreateMany,
  modetourParsedPricesToDepartureInputs,
  modetourPersistedHasCalendarCoverage,
  modetourPersistedSaveCoverageBreakdown,
  modetourScheduleRowsSubstantive,
  modetourSyntheticDepartureInputsForPersistedParsed,
} from '@/lib/register-modetour-price'
import { MODETOUR_REGISTER_CONFIRM_MONTHS_FORWARD } from '@/lib/scrape-date-bounds'
import {
  collectModetourDepartureInputs,
  modetourBaselineAcceptableForConfirm,
  parseModetourPackageProductNoFromUrl,
  type ModetourBaselineTrace,
} from '@/lib/modetour-departures'
import { collectModetourItineraryInputs } from '@/lib/modetour-itinerary-collector'
import {
  normalizeModetourHotelSummaryComposeBlock,
  normalizeModetourRegisterAdminTextareas,
} from '@/lib/register-modetour-admin-text'
import {
  countRegisterOptionalToursJsonRows,
  filterModetourOptionalToursStructuredJson,
  filterModetourOptionalTourRows,
} from '@/lib/register-modetour-options'
import {
  countModetourShoppingStopsJsonRows,
  filterModetourExtractionIssuesForModetourRegister,
  finalizeModetourRegisterParsedShopping,
} from '@/lib/register-modetour-shopping'
import { buildPriceDisplaySsot, validatePriceDisplaySsot } from '@/lib/price-display-ssot'
import type { RegisterPastedBlocksInput } from '@/lib/register-llm-blocks-modetour'
import { nullIfEmptyTrim, normalizeStringList } from '@/lib/null-normalize'
import { mergeDayHotelPlansForRegister } from '@/lib/day-hotel-plans-modetour'
import { normalizePromotionMarketingCopy } from '@/lib/promotion-copy-normalize'
import { addDaysIso, extractIsoDate, inferHeroReturnDayOffset } from '@/lib/hero-date-utils'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { departurePreviewRowToKeyFacts, resolveHeroTripDates } from '@/lib/product-hero-dates'
import { isScheduleAdultBookable } from '@/lib/price-utils'
import {
  extractFlightLegAutoFromFlightStructured,
  mergeFlatFlightNoIntoAuto,
  mergeFlightManualCorrectionOnReparse,
  type FlightManualCorrectionPayload,
} from '@/lib/flight-manual-correction-modetour'
import { buildRegisterPreviewCanonicalString } from '@/lib/register-preview-content-fingerprint-modetour'
import { buildRegisterVerificationBundle } from '@/lib/admin-register-verification-meta-modetour'
import {
  modetourHeroBodyHaystack,
  modetourMetaHeroBodyHaystack,
  pickFirstCalendarSampleDate,
} from '@/lib/parse-and-register-modetour-extras'
import {
  enrichModetourDepartureInputsFromFlightStructured,
  lastModetourAirlineDebug,
  mergeModetourAirlineFieldsIntoParsed,
} from '@/lib/register-modetour-flight'
import type { DepartureKeyFacts } from '@/lib/departure-key-facts'
import { createParseRegisterTiming } from '@/lib/parse-and-register-timing'
import {
  REGISTER_ADMIN_SNAPSHOT_STATUS,
  type RegisterAdminSnapshotStatus,
} from '@/lib/register-admin-audit-status-modetour'
import { nextRegisterAnalysisAttemptNo } from '@/lib/register-admin-analysis-store-modetour'
import {
  invokeRegisterParsePersistAnalysisAttempt,
  markRegisterAdminAnalysisPendingSavedWithTiming,
  persistRegisterAnalysisNormalizedFromParsed,
  persistRegisterAnalysisTrustedClientParsedRecord,
  resolveOrCreateRegisterAdminInputSnapshot,
} from '@/lib/register-admin-input-persist-modetour'
import { tryLoadRegisterParsedForConfirmReuse } from '@/lib/register-admin-confirm-reuse-modetour'
import { travelScopeAndListingKindFromAdminRegister } from '@/lib/register-admin-travel-category'
import { applyDepartureTerminalMeetingInfo } from '@/lib/meeting-terminal-rules'
import {
  attachPreservedMeetingOperatorToStructuredSignals,
  stripBodyDerivedMeetingFromRegisterParsed,
} from '@/lib/meeting-operator-ssot'

function modetourLegCardHasContent(leg: DepartureKeyFacts['outbound']): boolean {
  if (!leg) return false
  return Boolean(
    leg.departureAirport?.trim() ||
      leg.arrivalAirport?.trim() ||
      leg.departureAtText?.trim() ||
      leg.arrivalAtText?.trim() ||
      leg.flightNo?.trim()
  )
}

function modetourStructuredLegHasCore(leg: {
  departureAirport?: string | null
  arrivalAirport?: string | null
  departureDate?: string | null
  departureTime?: string | null
  arrivalDate?: string | null
  arrivalTime?: string | null
  flightNo?: string | null
}): boolean {
  return Boolean(
    leg.flightNo?.trim() ||
      leg.departureAirport?.trim() ||
      leg.arrivalAirport?.trim() ||
      (String(leg.departureDate ?? '').trim() && String(leg.departureTime ?? '').trim()) ||
      (String(leg.arrivalDate ?? '').trim() && String(leg.arrivalTime ?? '').trim()) ||
      (String(leg.departureDate ?? '').trim() && String(leg.arrivalDate ?? '').trim())
  )
}

function enrichModetourPrefetchedDeparturesWithTable(
  inputs: DepartureInput[],
  table: RegisterParsed['productPriceTable']
): DepartureInput[] {
  const bodyAdult =
    table?.adultPrice != null && Number(table.adultPrice) > 0 ? Math.round(Number(table.adultPrice)) : null
  return inputs.map((d) => {
    const prefetchAdult = typeof d.adultPrice === 'number' && d.adultPrice > 0 ? d.adultPrice : 0
    const adultNum = bodyAdult != null && bodyAdult > 0 ? bodyAdult : prefetchAdult
    if (!adultNum) return d
    const linked = computeModetourLinkedDeparturePrices({
      adultTotal: adultNum,
      table,
      rowChildBedBase: d.childBedPrice ?? null,
      rowChildNoBedBase: d.childNoBedPrice ?? null,
      rowInfantBase: d.infantPrice ?? null,
      childFuel: 0,
      infantFuel: 0,
    })
    return {
      ...d,
      childBedPrice: linked.childBedPrice > 0 ? linked.childBedPrice : d.childBedPrice,
      childNoBedPrice: linked.childNoBedPrice > 0 ? linked.childNoBedPrice : d.childNoBedPrice,
      infantPrice: linked.infantPrice > 0 ? linked.infantPrice : d.infantPrice,
    }
  })
}

function modetourParsedFlightStructuredHasLegCore(parsed: RegisterParsed): boolean {
  const fs = parsed.detailBodyStructured?.flightStructured
  if (!fs) return false
  return modetourStructuredLegHasCore(fs.outbound) || modetourStructuredLegHasCore(fs.inbound)
}

/** 항공 "핵심" 판별: 미리보기 행 요약(outboundSummary 등)은 비어 있을 수 있어 leg·구조화·요약을 함께 본다. */
function modetourFlightHasUsableCore(facts: DepartureKeyFacts | null, parsed: RegisterParsed): boolean {
  if (modetourParsedFlightStructuredHasLegCore(parsed)) return true
  if (!facts) return false
  const hasSummary = Boolean((facts.outboundSummary ?? '').trim() || (facts.inboundSummary ?? '').trim())
  const hasLeg = modetourLegCardHasContent(facts.outbound) || modetourLegCardHasContent(facts.inbound)
  if (facts.airline?.trim()) return hasLeg || hasSummary
  return hasLeg || hasSummary
}

/** 모두투어 등록 POST 전용 — 자체 핸들러·오케스트레이션 */
let currentLogPrefix = '[parse-and-register-modetour]'
const isDev = process.env.NODE_ENV === 'development'

type ParseRegisterLogCtx = {
  stage: string
  mode: 'preview' | 'confirm'
  hasPastedRaw: boolean
  hasPreviewToken: boolean
  hasGeminiKey: boolean
}

function logParseAndRegister(outcome: 'ok' | 'fail', ctx: ParseRegisterLogCtx, err?: unknown) {
  const e = err != null ? (err instanceof Error ? err : new Error(String(err))) : undefined
  if (outcome === 'ok') {
    console.log(currentLogPrefix, outcome, {
      stage: ctx.stage,
      mode: ctx.mode,
      hasPastedRaw: ctx.hasPastedRaw,
      hasPreviewToken: ctx.hasPreviewToken,
      hasGeminiKey: ctx.hasGeminiKey,
    })
    return
  }
  if (!e) return
  const base = {
    stage: ctx.stage,
    mode: ctx.mode,
    hasPastedRaw: ctx.hasPastedRaw,
    hasPreviewToken: ctx.hasPreviewToken,
    hasGeminiKey: ctx.hasGeminiKey,
    errorName: e.name,
    errorMessage: e.message,
  }
  if (isDev) {
    console.error(currentLogPrefix, outcome, {
      ...base,
      stackPreview: e.stack ? e.stack.slice(0, 1200) : undefined,
    })
  } else {
    console.error(currentLogPrefix, outcome, { stage: ctx.stage, errorName: e.name, mode: ctx.mode })
  }
}

function devErrorDebug(ctx: ParseRegisterLogCtx, err: unknown) {
  if (!isDev) return undefined
  const e = err instanceof Error ? err : new Error(String(err))
  return {
    stage: ctx.stage,
    mode: ctx.mode,
    hasPastedRaw: ctx.hasPastedRaw,
    hasPreviewToken: ctx.hasPreviewToken,
    hasGeminiKey: ctx.hasGeminiKey,
    errorName: e.name,
    errorMessage: e.message,
    stackPreview: e.stack ? e.stack.slice(0, 1200) : undefined,
  }
}

function assertJsonSerializable(ctx: ParseRegisterLogCtx, label: string, payload: unknown) {
  try {
    JSON.stringify(payload)
  } catch (ser) {
    logParseAndRegister('fail', { ...ctx, stage: label }, ser)
    throw new Error('응답 본문을 JSON으로 직렬화할 수 없습니다. 관리자에게 문의하세요.')
  }
}

function buildScheduleJson(parsedSchedule: Array<{ day: number; title: string; description: string; imageKeyword: string }>) {
  return JSON.stringify(
    parsedSchedule.map((day) => ({
      day: day.day,
      title: day.title,
      description: day.description,
      imageKeyword: day.imageKeyword,
      imageUrl: null,
    }))
  )
}

/** ItineraryDay: 일정표 schedule.hotelText(본문 추출) → 그다음 초안 hotelText → accommodation 보정 */
function modetourItineraryDraftsApplyScheduleHotelBodyFirst(
  drafts: ReturnType<typeof registerScheduleToDayInputs>,
  schedule: Array<{ day?: number; hotelText?: string | null }>
): ReturnType<typeof registerScheduleToDayInputs> {
  const bodyByDay = new Map<number, string>()
  for (const s of schedule) {
    const day = Number(s.day)
    if (!Number.isInteger(day) || day < 1) continue
    const ht = typeof s.hotelText === 'string' ? s.hotelText.trim() : ''
    if (!ht || ht === '-' || ht === '—' || ht === '–') continue
    bodyByDay.set(day, ht.slice(0, 500))
  }
  return drafts.map((d) => {
    const fromBody = bodyByDay.get(d.day)
    const mergedHt = fromBody ?? (d.hotelText?.trim() || '')
    const htNorm =
      mergedHt && mergedHt !== '-' && mergedHt !== '—' && mergedHt !== '–' ? mergedHt.slice(0, 500) : null
    return {
      ...d,
      hotelText: htNorm,
      accommodation: htNorm ?? (d.accommodation?.trim() || null),
    }
  })
}

/**
 * 확정(confirm) 시 일정 day 초안이 패키지 HTML 스크래핑 기반이면 summary가 장문 raw가 된다.
 * 붙여넣기 파이프로 정제된 `parsed.schedule`과 동일한 요약·식사·rawBlock을 일차별로 덮어쓴다.
 * (숙소는 위 `modetourItineraryDraftsApplyScheduleHotelBodyFirst`가 schedule 기준으로 이미 맞춤.)
 * 요약이 매우 짧아도 식사 필드가 있으면 식사만 반영(요약/ rawBlock 은 짧을 때 초안 유지).
 */
function modetourItineraryDraftsApplyParsedScheduleOverlay(
  drafts: ReturnType<typeof registerScheduleToDayInputs>,
  schedule: NonNullable<RegisterParsed['schedule']>
): ReturnType<typeof registerScheduleToDayInputs> {
  if (!schedule?.length || !drafts.length) return drafts
  const rows = registerScheduleToDayInputs(schedule)
  const byDay = new Map(rows.map((r) => [r.day, r]))
  const schedByDay = new Map(
    schedule
      .map((s) => [Number(s.day), s] as const)
      .filter(([day]) => Number.isInteger(day) && day >= 1)
  )
  return drafts.map((d) => {
    const o = byDay.get(d.day)
    if (!o) return d
    const sRow = schedByDay.get(d.day)
    const mealFromDesc = extractModetourMealSummaryFromScheduleDescription(
      typeof sRow?.description === 'string' ? sRow.description : undefined
    )
    const brief = String(o.summaryTextRaw ?? '').trim()
    const hasMeal =
      Boolean(o.breakfastText?.trim()) ||
      Boolean(o.lunchText?.trim()) ||
      Boolean(o.dinnerText?.trim()) ||
      Boolean(o.mealSummaryText?.trim()) ||
      Boolean(o.meals?.trim()) ||
      Boolean(mealFromDesc)
    const hasMealFromDraft =
      Boolean(d.breakfastText?.trim()) ||
      Boolean(d.lunchText?.trim()) ||
      Boolean(d.dinnerText?.trim()) ||
      Boolean(d.mealSummaryText?.trim()) ||
      Boolean(d.meals?.trim())
    // 요약이 짧아도 붙여넣기 일정에 식사 줄이 있으면 반드시 반영 (그렇지 않으면 공개 상세가「식사 - 불포함」)
    if (brief.length < 8 && !hasMeal && !hasMealFromDraft) return d
    const pickMeal = (a: string | null | undefined, b: string | null | undefined) =>
      (a?.trim() || b?.trim() || null) as string | null
    const mergedMeals = o.meals?.trim() || mealFromDesc || d.meals?.trim() || null
    return {
      ...d,
      summaryTextRaw: brief.length >= 8 ? o.summaryTextRaw : d.summaryTextRaw,
      rawBlock: brief.length >= 8 ? (o.rawBlock ?? d.rawBlock) : d.rawBlock,
      breakfastText: pickMeal(o.breakfastText, d.breakfastText),
      lunchText: pickMeal(o.lunchText, d.lunchText),
      dinnerText: pickMeal(o.dinnerText, d.dinnerText),
      mealSummaryText: pickMeal(o.mealSummaryText, d.mealSummaryText) ?? mealFromDesc ?? null,
      meals: mergedMeals,
    }
  })
}

function mergeRawMetaWithStructuredSignals(
  existingRawMeta: string | null | undefined,
  parsed: RegisterParsed,
  heroAudit?: { heroDepartureDateSource: string; heroReturnDateSource: string } | null
): string | null {
  // SSOT docs:
  // - docs/detail-body-input-priority.md (raw/structured/final boundaries)
  // - docs/detail-body-review-policy.md (review + exposure semantics)
  let base: Record<string, unknown> = {}
  if (existingRawMeta && typeof existingRawMeta === 'string') {
    try {
      const obj = JSON.parse(existingRawMeta) as unknown
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) base = obj as Record<string, unknown>
    } catch {
      base = {}
    }
  }
  const structured = {
    optionalTourNoticeRaw: parsed.optionalTourNoticeRaw ?? null,
    optionalTourNoticeItems: parsed.optionalTourNoticeItems ?? [],
    optionalTourCount: parsed.optionalTourCount ?? null,
    optionalTourDisplayNoticeManual: parsed.optionalTourDisplayNoticeManual ?? null,
    optionalTourDisplayNoticeFinal: parsed.optionalTourDisplayNoticeFinal ?? null,
    optionalToursLlmSupplementJson: parsed.optionalToursLlmSupplementJson ?? null,
    shoppingNoticeRaw: parsed.shoppingNoticeRaw ?? null,
    shoppingStops: parsed.shoppingStops ?? null,
    shoppingStopsLlmSupplementJson: parsed.shoppingStopsLlmSupplementJson ?? null,
    hasShopping: parsed.hasShopping ?? false,
    shoppingVisitCount: parsed.shoppingVisitCount ?? null,
    hasFreeTime: parsed.hasFreeTime ?? false,
    freeTimeSummaryText: parsed.freeTimeSummaryText ?? null,
    freeTimeRawMentions: parsed.freeTimeRawMentions ?? [],
    headerBadges: parsed.headerBadges ?? null,
    extractionFieldIssues: parsed.extractionFieldIssues ?? [],
    priceTableRawText: parsed.priceTableRawText ?? null,
    productPriceTable: parsed.productPriceTable ?? null,
    priceTableRawHtml: parsed.priceTableRawHtml ?? null,
    airlineName: parsed.airlineName ?? null,
    departureSegmentText: parsed.departureSegmentText ?? null,
    returnSegmentText: parsed.returnSegmentText ?? null,
    outboundFlightNo: parsed.outboundFlightNo ?? null,
    inboundFlightNo: parsed.inboundFlightNo ?? null,
    departureDateTimeRaw: parsed.departureDateTimeRaw ?? null,
    arrivalDateTimeRaw: parsed.arrivalDateTimeRaw ?? null,
    routeRaw: parsed.routeRaw ?? null,
    meetingInfoRaw: parsed.meetingInfoRaw ?? null,
    meetingPlaceRaw: parsed.meetingPlaceRaw ?? null,
    meetingNoticeRaw: parsed.meetingNoticeRaw ?? null,
    meetingFallbackText: parsed.meetingFallbackText ?? null,
    hotelInfoRaw: nullIfEmptyTrim(parsed.hotelInfoRaw),
    hotelNames: normalizeStringList(parsed.hotelNames),
    dayHotelPlans: parsed.dayHotelPlans?.length ? parsed.dayHotelPlans : null,
    hotelSummaryText: nullIfEmptyTrim(parsed.hotelSummaryText),
    hotelStatusText: nullIfEmptyTrim(parsed.hotelStatusText),
    hotelNoticeRaw: nullIfEmptyTrim(parsed.hotelNoticeRaw),
    singleRoomSurchargeAmount: parsed.singleRoomSurchargeAmount ?? null,
    singleRoomSurchargeCurrency: parsed.singleRoomSurchargeCurrency ?? null,
    singleRoomSurchargeRaw: parsed.singleRoomSurchargeRaw ?? null,
    singleRoomSurchargeDisplayText: parsed.singleRoomSurchargeDisplayText ?? null,
    hasSingleRoomSurcharge: parsed.hasSingleRoomSurcharge ?? false,
    mustKnowRaw: parsed.mustKnowRaw ?? null,
    mustKnowItems: parsed.mustKnowItems ?? [],
    mustKnowSource: parsed.mustKnowSource ?? null,
    mustKnowNoticeRaw: parsed.mustKnowNoticeRaw ?? null,
    minimumDepartureCount: parsed.minimumDepartureCount ?? null,
    minimumDepartureText: parsed.minimumDepartureText ?? null,
    isDepartureGuaranteed: parsed.isDepartureGuaranteed ?? null,
    currentBookedCount: parsed.currentBookedCount ?? null,
    departureStatusText: parsed.departureStatusText ?? null,
    hotelPasteRaw: parsed.detailBodyStructured?.raw.hotelPasteRaw ?? null,
    hotelStructured: parsed.detailBodyStructured?.hotelStructured ?? null,
    optionalToursPasteRaw: parsed.detailBodyStructured?.raw.optionalToursPasteRaw ?? null,
    optionalToursStructuredCanonical: (() => {
      const o = parsed.detailBodyStructured?.optionalToursStructured
      if (!o) return null
      const rows = o.rows?.length ? filterModetourOptionalTourRows(o.rows) : o.rows
      return rows === o.rows ? o : { ...o, rows }
    })(),
    shoppingPasteRaw: parsed.detailBodyStructured?.raw.shoppingPasteRaw ?? null,
    shoppingStructured: parsed.detailBodyStructured?.shoppingStructured ?? null,
    flightRaw: parsed.detailBodyStructured?.raw.flightRaw ?? null,
    flightStructured: parsed.detailBodyStructured?.flightStructured ?? null,
    includedExcludedStructured: parsed.detailBodyStructured?.includedExcludedStructured ?? null,
    detailBodySections: parsed.detailBodyStructured?.sections ?? null,
    detailBodyNormalizedRaw: parsed.detailBodyStructured?.normalizedRaw ?? null,
    detailBodyReview: parsed.detailBodyStructured?.review ?? null,
    ...(parsed.registerParseAudit ? { registerParseAudit: parsed.registerParseAudit } : {}),
    ...(heroAudit?.heroDepartureDateSource
      ? { heroDepartureDateSource: heroAudit.heroDepartureDateSource }
      : {}),
    ...(heroAudit?.heroReturnDateSource ? { heroReturnDateSource: heroAudit.heroReturnDateSource } : {}),
  }
  const prevFlight = (() => {
    const oldS = base.structuredSignals
    if (!oldS || typeof oldS !== 'object' || Array.isArray(oldS)) return undefined
    const c = (oldS as Record<string, unknown>).flightManualCorrection
    if (!c || typeof c !== 'object' || Array.isArray(c)) return undefined
    return c as FlightManualCorrectionPayload
  })()
  const fs = parsed.detailBodyStructured?.flightStructured ?? null
  let autoLegs = extractFlightLegAutoFromFlightStructured(fs)
  autoLegs = mergeFlatFlightNoIntoAuto(autoLegs, {
    outboundFlightNo: parsed.outboundFlightNo ?? null,
    inboundFlightNo: parsed.inboundFlightNo ?? null,
  })
  const mergedFlight = mergeFlightManualCorrectionOnReparse(prevFlight, autoLegs)
  if (mergedFlight) (structured as Record<string, unknown>).flightManualCorrection = mergedFlight as unknown

  return JSON.stringify({
    ...base,
    structuredSignals: attachPreservedMeetingOperatorToStructuredSignals(base, structured as Record<string, unknown>),
  })
}

/** 관리자 분리 붙여넣기 블록(선택) */
function parsePastedBlocksFromBody(body: Record<string, unknown>): Partial<
  Pick<RegisterPastedBlocksInput, 'optionalTour' | 'shopping' | 'hotel' | 'airlineTransport'>
> | null {
  const b = body.pastedBlocks
  if (!b || typeof b !== 'object' || Array.isArray(b)) return null
  const o = b as Record<string, unknown>
  const pick = (key: string) => {
    const v = o[key]
    return typeof v === 'string' && v.trim() ? v.trim().slice(0, 32000) : undefined
  }
  const out: Partial<Pick<RegisterPastedBlocksInput, 'optionalTour' | 'shopping' | 'hotel' | 'airlineTransport'>> = {}
  const ot = pick('optionalTour')
  if (ot) out.optionalTour = ot
  const sh = pick('shopping')
  if (sh) out.shopping = sh
  const ho = pick('hotel')
  if (ho) out.hotel = ho
  const air = pick('airlineTransport')
  if (air) out.airlineTransport = air
  return Object.keys(out).length > 0 ? out : null
}

function computePreviewContentDigestForBody(
  body: Record<string, unknown>,
  forcedBrandKey: string | null | undefined
): string {
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const brandKey =
    forcedBrandKey != null && forcedBrandKey !== ''
      ? forcedBrandKey
      : typeof body.brandKey === 'string'
        ? body.brandKey.trim() || null
        : null
  let originUrl: string | null = typeof body.originUrl === 'string' ? body.originUrl.trim() : null
  if (originUrl === '') originUrl = null
  if (originUrl && originUrl.length > 2000) originUrl = originUrl.slice(0, 2000)
  const travelScope = typeof body.travelScope === 'string' ? body.travelScope.trim() : ''
  const pb = parsePastedBlocksFromBody(body)
  const pastedBlocksForFp = pb
    ? {
        airlineTransport: pb.airlineTransport ?? undefined,
        hotel: pb.hotel ?? undefined,
        optionalTour: pb.optionalTour ?? undefined,
        shopping: pb.shopping ?? undefined,
      }
    : undefined
  const canonical = buildRegisterPreviewCanonicalString({
    text,
    brandKey,
    originUrl,
    travelScope,
    pastedBlocks: pastedBlocksForFp,
  })
  return createHash('sha256').update(canonical, 'utf8').digest('base64url')
}

function parseOptionalTourDisplayNoticeManualFromBody(body: Record<string, unknown>): string | null {
  const t = body.optionalTourDisplayNoticeManual
  if (typeof t !== 'string') return null
  const s = t.trim()
  return s ? s.slice(0, 2000) : null
}

export async function handleParseAndRegisterModetourRequest(request: Request) {
  const parseFn = parseForRegisterModetour
  const forcedBrandKey = 'modetour'
  currentLogPrefix = '[parse-and-register-modetour]'
  let stage = 'init'
  let ctx: ParseRegisterLogCtx = {
    stage: 'init',
    mode: 'preview',
    hasPastedRaw: false,
    hasPreviewToken: false,
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY?.trim()),
  }
  try {
    stage = 'requireAdmin'
    ctx.stage = stage
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const timing = createParseRegisterTiming(currentLogPrefix)
    timing.mark('start')

    stage = 'parseRequestJson'
    ctx.stage = stage
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch (jsonErr) {
      logParseAndRegister('fail', ctx, jsonErr)
      return NextResponse.json(
        {
          success: false,
          error: '요청 본문이 올바른 JSON이 아닙니다.',
          ...(isDev ? { debug: devErrorDebug(ctx, jsonErr) } : {}),
        },
        { status: 400 }
      )
    }
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    const travelScope = typeof body.travelScope === 'string' ? body.travelScope.trim() : ''
    const clientDeclaredBrand = typeof body.brandKey === 'string' ? body.brandKey.trim() : ''
    if (clientDeclaredBrand && clientDeclaredBrand !== forcedBrandKey) {
      return NextResponse.json(
        {
          error:
            '요청 brandKey와 엔드포인트가 맞지 않습니다. 모두투어 전용 API에는 brandKey "modetour"만 허용됩니다. 관리자에서 모두투어를 선택했는지 확인하세요.',
        },
        { status: 400 }
      )
    }
    const brandKey = forcedBrandKey
    const incomingOriginSource =
      typeof body.originSource === 'string' ? body.originSource.trim() : '직접입력'
    const originSource = normalizeOriginSource(incomingOriginSource, brandKey)
    let originUrl: string | null = typeof body.originUrl === 'string' ? body.originUrl.trim() : null
    if (originUrl === '') originUrl = null
    if (originUrl && originUrl.length > 2000) originUrl = originUrl.slice(0, 2000)
    if (originUrl && !/^https?:\/\//i.test(originUrl)) {
      return NextResponse.json(
        { error: '상품 URL은 http:// 또는 https:// 로 시작해야 합니다.' },
        { status: 400 }
      )
    }

    const modeRaw = typeof body.mode === 'string' ? body.mode.trim().toLowerCase() : ''
    const mode = modeRaw === 'confirm' ? 'confirm' : 'preview'
    ctx.mode = mode
    const hasParsed = Boolean((body.parsed as { originCode?: string } | undefined)?.originCode)
    const earlySource = normalizeOriginSource(incomingOriginSource, brandKey)
    ctx.hasPastedRaw = text.length > 0 || hasParsed
    ctx.hasPreviewToken = typeof body.previewToken === 'string' && body.previewToken.trim().length > 0
    ctx.hasGeminiKey = Boolean(process.env.GEMINI_API_KEY?.trim())

    if (!text && !hasParsed) {
      return NextResponse.json(
        {
          error:
            '모두투어 상세 본문을 붙여넣어 주세요. 복붙 텍스트가 입력(SSOT)이며, URL만으로는 미리보기할 수 없습니다.',
        },
        { status: 400 }
      )
    }

    const pastedBlocks = parsePastedBlocksFromBody(body)
    const optionalTourDisplayNoticeManual = parseOptionalTourDisplayNoticeManualFromBody(body)
    timing.mark('after-raw-input-normalize')

    stage = 'testGeminiConnection'
    ctx.stage = stage
    const connectionTest = await testGeminiConnection()
    if (!connectionTest.ok && isDev) {
      console.warn(currentLogPrefix, 'geminiConnectionTest', { ok: false, model: connectionTest.model, error: connectionTest.error })
    }

    if (!hasParsed && !process.env.GEMINI_API_KEY?.trim()) {
      stage = 'missingGeminiKey'
      ctx.stage = stage
      ctx.hasGeminiKey = false
      const msg =
        '등록 파싱에 필요한 GEMINI_API_KEY가 설정되지 않았습니다. .env.local에 키를 추가한 뒤 개발 서버를 재시작하세요.'
      if (isDev) {
        console.warn(currentLogPrefix, 'blocked', {
          stage: 'missingGeminiKey',
          mode: ctx.mode,
          hasPastedRaw: ctx.hasPastedRaw,
          hasPreviewToken: ctx.hasPreviewToken,
          hasGeminiKey: false,
          missingEnv: ['GEMINI_API_KEY'],
        })
      } else {
        console.warn(currentLogPrefix, 'blocked', { stage: 'missingGeminiKey', mode: ctx.mode })
      }
      return NextResponse.json(
        {
          success: false,
          error: msg,
          ...(isDev
            ? {
                debug: {
                  stage: 'missingGeminiKey',
                  mode: ctx.mode,
                  hasPastedRaw: ctx.hasPastedRaw,
                  hasPreviewToken: ctx.hasPreviewToken,
                  hasGeminiKey: false,
                  missingEnv: ['GEMINI_API_KEY'] as const,
                },
              }
            : {}),
        },
        { status: 400 }
      )
    }

    stage = hasParsed ? 'reuseParsedBody' : 'parseForRegister'
    ctx.stage = stage
    let parsed: RegisterParsed | undefined
    const onTiming = (label: string) => timing.mark(label)
    let registerSnapshotId: string | null = null
    let lastPipelineAnalysisId: string | null = null
    let llmRanThisRequest = false
    let reusedConfirmAnalysis = false

    if (mode === 'confirm' && !hasParsed) {
      const sid = typeof body.registerSnapshotId === 'string' ? body.registerSnapshotId.trim() : ''
      const aid = typeof body.registerAnalysisId === 'string' ? body.registerAnalysisId.trim() : ''
      if (sid && aid) {
        const loaded = await tryLoadRegisterParsedForConfirmReuse({
          snapshotId: sid,
          analysisId: aid,
          body,
          forcedBrandKey,
        })
        if (loaded) {
          parsed = loaded
          reusedConfirmAnalysis = true
          registerSnapshotId = sid
          lastPipelineAnalysisId = aid
          timing.mark('after-confirm-reuse-from-analysis')
        }
      }
    }

    if (mode === 'confirm' && !hasParsed && !reusedConfirmAnalysis) {
      console.info('[parse-and-register-modetour][save-path]', {
        brandKey: 'modetour',
        hasPersistedParsedResult: false,
        usedPersistedParsedResult: false,
        skippedRawReparseInSave: true,
        skippedRepairInSave: true,
        skippedMustKnowSupplementInSave: true,
        blockedUnpersistedConfirm: true,
      })
      return NextResponse.json(
        {
          error:
            'preview 분석 결과를 다시 불러오지 못했습니다. 동일 registerSnapshotId·registerAnalysisId로 미리보기를 다시 실행하세요.',
        },
        { status: 400 }
      )
    }

    if (!hasParsed && !reusedConfirmAnalysis) {
      registerSnapshotId = await resolveOrCreateRegisterAdminInputSnapshot({
        body,
        forcedBrandKey,
        brandKey,
        originSource,
        originUrl,
        text,
        travelScope,
        mode,
        originCodeHint: null,
        timing,
      })
      const run = await invokeRegisterParsePersistAnalysisAttempt({
        snapshotId: registerSnapshotId,
        timing,
        parseFn,
        text,
        originSource,
        brandKey,
        originUrl,
        pastedBlocks,
        forPreview: mode === 'preview',
        onTiming,
      })
      timing.mark('after-parseFn')
      if (!run.ok) {
        logParseAndRegister('fail', ctx, run.error)
        return NextResponse.json(
          {
            success: false,
            rawSaved: true,
            analysisFailed: true,
            registerSnapshotId,
            registerAnalysisId: run.analysisId,
            error: run.error.message,
            parseErrorMessage: run.error.parseErrorMessage,
            repairAttempted: run.error.repairAttempted,
            ...(isDev ? { debug: devErrorDebug(ctx, run.error) } : {}),
          },
          { status: 422 }
        )
      }
      parsed = run.parsed
      lastPipelineAnalysisId = run.analysisId
      llmRanThisRequest = true
    } else if (hasParsed) {
      parsed = stripRegisterInternalArtifacts(body.parsed as RegisterParsed)
      timing.mark('after-parseFn-reused')
    }

    if (!parsed) {
      return NextResponse.json(
        { error: '분석 결과를 불러오지 못했습니다. 미리보기를 다시 실행하세요.' },
        { status: 400 }
      )
    }

    if (hasParsed && !(parsed.dayHotelPlans?.length)) {
      const mergedPlans = mergeDayHotelPlansForRegister(
        undefined,
        parsed.schedule,
        parsed.hotelInfoRaw ?? null,
        pastedBlocks?.hotel ?? null
      )
      if (mergedPlans.length) {
        parsed = { ...parsed, dayHotelPlans: mergedPlans }
      }
    }

    /**
     * `invokeRegisterParsePersistAnalysisAttempt`(parseForRegister) 안에서는 이미 붙여넣기 보강이 들어가지만,
     * 확정 시 클라이언트 `parsed`만 재사용하는 경로(hasParsed·스냅샷 재로드)에서는 서버에서 한 번도 안 돈다.
     * 그러면 일정 행에 식사·호텔이 본문에만 있고 필드는 비는 채로 저장될 수 있음.
     */
    if (text.trim() && !llmRanThisRequest) {
      parsed = supplementModetourScheduleFromPastedBody(parsed, text)
    }

    if (!parsed.originCode || parsed.originCode === '미지정') {
      return NextResponse.json(
        { error: '상품코드(originCode)를 추출할 수 없습니다.' },
        { status: 400 }
      )
    }

    const effectiveOriginSource = normalizeOriginSource(parsed.originSource?.trim() || originSource, brandKey)

    if (mode === 'confirm') {
      stage = 'verifyPreviewToken'
      ctx.stage = stage
      const tok = typeof body.previewToken === 'string' ? body.previewToken : ''
      if (!verifyPreviewToken(tok, effectiveOriginSource, parsed.originCode)) {
        return NextResponse.json(
          { error: '유효한 미리보기가 필요합니다. 미리보기를 실행한 뒤 발급된 토큰으로만 저장할 수 있습니다.' },
          { status: 403 }
        )
      }
      if (hasParsed) {
        stage = 'verifyPreviewContentDigest'
        ctx.stage = stage
        const sent = typeof body.previewContentDigest === 'string' ? body.previewContentDigest.trim() : ''
        if (!sent) {
          return NextResponse.json(
            {
              error:
                '미리보기 콘텐츠 지문(previewContentDigest)이 없습니다. 클라이언트를 최신으로 한 뒤 미리보기부터 다시 실행하세요.',
            },
            { status: 400 }
          )
        }
        const expected = computePreviewContentDigestForBody(body, forcedBrandKey)
        if (sent !== expected) {
          return NextResponse.json(
            {
              error:
                '본문 또는 붙여넣기 블록이 미리보기 이후 변경되었습니다. [AI 실시간 분석 시작]으로 다시 분석한 뒤 저장하세요.',
            },
            { status: 409 }
          )
        }
      }
      if (hasParsed && text.trim()) {
        registerSnapshotId = await resolveOrCreateRegisterAdminInputSnapshot({
          body,
          forcedBrandKey,
          brandKey,
          originSource,
          originUrl,
          text,
          travelScope,
          mode: 'confirm',
          originCodeHint: parsed.originCode ?? null,
          timing,
        })
      }
      console.info('[parse-and-register-modetour][save-path]', {
        brandKey: 'modetour',
        hasPersistedParsedResult: hasParsed || reusedConfirmAnalysis,
        usedPersistedParsedResult: hasParsed || reusedConfirmAnalysis,
        skippedRawReparseInSave: !llmRanThisRequest,
        skippedRepairInSave: !llmRanThisRequest,
        skippedMustKnowSupplementInSave: !llmRanThisRequest,
      })
    }

    if (mode === 'confirm' && !(parsed.dayHotelPlans?.length)) {
      const mergedPlans = mergeDayHotelPlansForRegister(
        undefined,
        parsed.schedule,
        parsed.hotelInfoRaw ?? null,
        pastedBlocks?.hotel ?? null
      )
      if (mergedPlans.length) {
        parsed = { ...parsed, dayHotelPlans: mergedPlans }
      }
    }

    stage = 'buildRegisterDrafts'
    ctx.stage = stage
    parsed = finalizeModetourRegisterParsedPricing(parsed)
    parsed = mergeModetourAirlineFieldsIntoParsed(parsed)
    parsed = finalizeModetourRegisterParsedShopping(parsed)
    {
      const sanitizedOpt =
        filterModetourOptionalToursStructuredJson(parsed.optionalToursStructured ?? null) ??
        parsed.optionalToursStructured ??
        null
      const oc = countRegisterOptionalToursJsonRows(sanitizedOpt)
      parsed = {
        ...parsed,
        optionalToursStructured: sanitizedOpt,
        ...(oc != null ? { optionalTourCount: oc, hasOptionalTour: oc > 0 } : {}),
      }
    }
    parsed = {
      ...parsed,
      registerPreviewPolicyNotes: [
        ...(parsed.registerPreviewPolicyNotes ?? []),
        '모두투어: 「확정가·달력·가격표 SSOT」 표기는 상품가격 표의 성인·아동(엑베/노베)·유아 기본가에만 적용합니다.',
        '모두투어: 1인 객실 사용료·가이드/기사 경비·선택경비·개인경비·현지지급 성격 요금은 부가요금(등록 참고·불포함 탭)이며 확정가 후보가 아닙니다.',
        '모두투어: 현지합류 항목은 사용하지 않습니다.',
      ],
    }
    const schedule = parsed.schedule ?? []
    let modetourConfirmBaselineTrace: ModetourBaselineTrace | null = null
    let departureFromParsed: DepartureInput[]
    let itineraryDayDrafts: ReturnType<typeof registerScheduleToDayInputs>

    if (mode === 'confirm') {
      const pkgNo = parseModetourPackageProductNoFromUrl(originUrl)
      if (!originUrl?.trim() || !pkgNo) {
        departureFromParsed = []
        itineraryDayDrafts = []
      } else {
        const [depRes, itRes] = await Promise.all([
          collectModetourDepartureInputs(originUrl.trim(), {
            monthsForward: MODETOUR_REGISTER_CONFIRM_MONTHS_FORWARD,
          }),
          collectModetourItineraryInputs({ detailUrl: originUrl.trim() }),
        ])
        modetourConfirmBaselineTrace = depRes.baselineTrace
        if (modetourDepartureInputsSubstantive(depRes.inputs)) {
          departureFromParsed = enrichModetourPrefetchedDeparturesWithTable(
            depRes.inputs,
            parsed.productPriceTable ?? null
          )
        } else {
          departureFromParsed = []
        }
        /** 붙여넣기 `parsed.schedule`이 한 줄이라도 있으면 스크래핑 일정(itRes.days)으로 덮지 않음 — 식사 등 본문 일정이 조용히 사라지는 것 방지 */
        const schedFromPaste = registerScheduleToDayInputs(parsed.schedule ?? [])
        itineraryDayDrafts =
          schedFromPaste.length > 0
            ? schedFromPaste
            : modetourItineraryDayDraftsSubstantive(itRes.days)
              ? itRes.days
              : []
        console.info('[parse-and-register-modetour][confirm-prefetch]', {
          baselinePicked: depRes.baselineTrace?.pickedSource ?? null,
          departureRows: depRes.inputs.length,
          itineraryDays: itRes.days.length,
          usedDepartureDrafts: departureFromParsed.length,
          usedItineraryDrafts: itineraryDayDrafts.length,
        })
      }
    } else {
      departureFromParsed = modetourParsedPricesToDepartureInputs(
        parsed.prices ?? [],
        parsed.productPriceTable ?? null
      )
      if (departureFromParsed.length === 0) {
        departureFromParsed = modetourSyntheticDepartureInputsForPersistedParsed(parsed)
      }
      itineraryDayDrafts = registerScheduleToDayInputs(schedule ?? [])
    }

    if (mode === 'confirm' && itineraryDayDrafts.length === 0 && (schedule?.length ?? 0) > 0) {
      itineraryDayDrafts = registerScheduleToDayInputs(schedule ?? [])
    }

    if (itineraryDayDrafts.length > 0) {
      itineraryDayDrafts = modetourItineraryDraftsApplyScheduleHotelBodyFirst(itineraryDayDrafts, schedule)
      if (mode === 'confirm' && (schedule?.length ?? 0) > 0) {
        itineraryDayDrafts = modetourItineraryDraftsApplyParsedScheduleOverlay(itineraryDayDrafts, schedule)
      }
      itineraryDayDrafts = itineraryDayDrafts.map(stripCounselingTermsFromItineraryDayDraft)
    }

    parsed = stripBodyDerivedMeetingFromRegisterParsed(parsed)
    const departureInputs: DepartureInput[] = applyDepartureTerminalMeetingInfo(
      enrichModetourDepartureInputsFromFlightStructured(departureFromParsed, parsed)
    )
    if (process.env.MODETOUR_REGISTER_DEBUG === '1') {
      const px = lastModetourDeparturePricingSample
      const ax = lastModetourAirlineDebug
      console.log('[modetour-register-debug]', {
        adultPrice: px?.adultPrice,
        childBedPrice: px?.childBedPrice,
        childNoBedPrice: px?.childNoBedPrice,
        infantPrice: px?.infantPrice,
        pricingBasis: px?.pricingBasis,
        childNoBedPriceSource: px?.childNoBedPriceSource,
        productPriceTable: px?.productPriceTable,
        extractedAirlineRaw: ax?.extractedAirlineRaw,
        normalizedAirline: ax?.normalizedAirline,
        usedFallbackAirline: ax?.usedFallbackAirline,
      })
    }

    const modetourSaveCoverage = modetourPersistedSaveCoverageBreakdown({
      parsed,
      departureInputs,
      itineraryDayDrafts,
    })
    const modetourConfirmStrict =
      mode === 'confirm'
        ? modetourConfirmSaveGateStrict({ departureInputs, itineraryDayDrafts })
        : null

    if (mode === 'confirm') {
      const pkgNo = parseModetourPackageProductNoFromUrl(originUrl)
      if (!originUrl?.trim() || !pkgNo) {
        console.info('[parse-and-register-modetour][save-gate-strict]', {
          saveCoverageDeparture: modetourConfirmStrict?.saveCoverageDeparture ?? false,
          saveCoverageSchedule: modetourConfirmStrict?.saveCoverageSchedule ?? false,
          saveBlockedReason: 'missing_package_url_or_product_no',
        })
        return NextResponse.json(
          {
            success: false,
            code: 'MODETOUR_CONFIRM_REQUIRES_PACKAGE_URL',
            error:
              '등록 확정 전 모두투어 패키지 상세 URL에서 출발일·일정을 먼저 수집해야 합니다. originUrl(패키지 주소)을 확인하세요.',
            fieldIssues: [] as RegisterExtractionFieldIssue[],
          },
          { status: 400 }
        )
      }
      if (!modetourBaselineAcceptableForConfirm(modetourConfirmBaselineTrace)) {
        console.info('[parse-and-register-modetour][save-gate-strict]', {
          saveCoverageDeparture: modetourConfirmStrict?.saveCoverageDeparture ?? false,
          saveCoverageSchedule: modetourConfirmStrict?.saveCoverageSchedule ?? false,
          saveBlockedReason: 'modetour_baseline_title_unacceptable',
        })
        return NextResponse.json(
          {
            success: false,
            code: 'MODETOUR_BASELINE_TITLE_FAILED',
            error:
              '모두투어 상품명(기준 제목)을 상세 페이지에서 확정하지 못했습니다. 상품 헤더(h1)·제목이 보이는 URL인지 확인한 뒤 다시 시도하세요.',
            fieldIssues: [] as RegisterExtractionFieldIssue[],
          },
          { status: 422 }
        )
      }
      if (modetourConfirmStrict && !modetourConfirmStrict.pass) {
        let errMsg: string
        if (!modetourConfirmStrict.saveCoverageDeparture && !modetourConfirmStrict.saveCoverageSchedule) {
          errMsg =
            '등록 확정 전, 출발일 가격/상태(ProductDeparture)와 원문 일정표(ItineraryDay)가 먼저 수집되어야 합니다.'
        } else if (!modetourConfirmStrict.saveCoverageDeparture) {
          errMsg = '등록 확정 전, 출발일 가격/상태(ProductDeparture)가 먼저 수집되어야 합니다.'
        } else {
          errMsg = '등록 확정 전, 원문 일정표(ItineraryDay)가 먼저 수집되어야 합니다.'
        }
        console.info('[parse-and-register-modetour][save-gate-strict]', {
          saveCoverageDeparture: modetourConfirmStrict.saveCoverageDeparture,
          saveCoverageSchedule: modetourConfirmStrict.saveCoverageSchedule,
          saveBlockedReason: modetourConfirmStrict.saveBlockedReason,
        })
        return NextResponse.json(
          {
            success: false,
            code: 'MODETOUR_PREFETCH_INCOMPLETE',
            error: errMsg,
            saveCoverageDeparture: modetourConfirmStrict.saveCoverageDeparture,
            saveCoverageSchedule: modetourConfirmStrict.saveCoverageSchedule,
            saveBlockedReason: modetourConfirmStrict.saveBlockedReason,
            fieldIssues: [] as RegisterExtractionFieldIssue[],
          },
          { status: 422 }
        )
      }
    }

    const modetourCoveragePass =
      mode === 'confirm'
        ? Boolean(modetourConfirmStrict?.pass)
        : modetourPersistedHasCalendarCoverage({
            parsed,
            departureInputsLength: departureInputs.length,
            itineraryDayDraftsLength: itineraryDayDrafts.length,
            departureInputs,
            itineraryDayDrafts,
          })

    if (mode === 'confirm') {
      console.info('[parse-and-register-modetour][save-coverage]', {
        hasParsedInBody: hasParsed,
        reusedConfirmAnalysis,
        usedPersistedParsedResult: hasParsed || reusedConfirmAnalysis,
        saveCoverageDeparture: modetourConfirmStrict?.saveCoverageDeparture ?? modetourSaveCoverage.saveCoverageDeparture,
        saveCoveragePrice: modetourSaveCoverage.saveCoveragePrice,
        saveCoverageSchedule: modetourConfirmStrict?.saveCoverageSchedule ?? modetourSaveCoverage.saveCoverageSchedule,
        saveBlockedReason: modetourCoveragePass ? null : modetourConfirmStrict?.saveBlockedReason ?? 'insufficient_substantive_departure_price_or_schedule',
        modetourPriceTableSlots: {
          adultPrice: parsed.productPriceTable?.adultPrice ?? null,
          childExtraBedPrice: parsed.productPriceTable?.childExtraBedPrice ?? null,
          childNoBedPrice: parsed.productPriceTable?.childNoBedPrice ?? null,
          infantPrice: parsed.productPriceTable?.infantPrice ?? null,
        },
        modetourDepartureChildPricingSample: lastModetourDeparturePricingSample,
        parsedPricesLen: (parsed.prices ?? []).length,
        parsedScheduleLen: (parsed.schedule ?? []).length,
        hasProductPriceTable: Boolean(parsed.productPriceTable),
        productPriceTableAdult: parsed.productPriceTable?.adultPrice ?? null,
        priceFrom: parsed.priceFrom ?? null,
        hasFlightStructured: Boolean(parsed.detailBodyStructured?.flightStructured),
        departureFromParsedLen: departureFromParsed.length,
        departureInputsLen: departureInputs.length,
        itineraryDayDraftsLen: itineraryDayDrafts.length,
        hasParsedDepartureDrafts: departureInputs.length > 0,
        hasParsedPriceDrafts: (parsed.prices ?? []).length > 0,
        hasParsedSchedule: (parsed.schedule ?? []).length > 0,
        hasItineraryDayDrafts: itineraryDayDrafts.length > 0,
        hasProductDepartureDrafts: departureInputs.length > 0,
        persistedCoverageOk: modetourCoveragePass,
        modetourPriceTraceTail: lastModetourPriceClassificationTrace.slice(-12),
      })
    }

    const geminiPm = parsePricePromotionFromGeminiJson(
      (parsed as { pricePromotion?: unknown }).pricePromotion
    )
    let mergedPromotion = mergePricePromotionLayers(null, geminiPm, null, null)

    const representativeCurrentSellingPrice =
      departureInputs.find((r) => typeof r.adultPrice === 'number' && r.adultPrice > 0)?.adultPrice ??
      parsed.productPriceTable?.adultPrice ??
      null

    const reconciledPromo = reconcilePromotionSalePriceWithAuthoritative(
      mergedPromotion,
      representativeCurrentSellingPrice,
      geminiPm
    )
    mergedPromotion = reconciledPromo.snapshot
    const promotionFieldIssues: PricePromotionFieldIssue[] = [
      ...buildPricePromotionFieldIssues(mergedPromotion),
      ...reconciledPromo.extraIssues,
    ]

    const flowFieldIssues: PricePromotionFieldIssue[] = []
    const calendarDataMissing = mode === 'confirm' && !modetourCoveragePass
    // 미리보기는 prices[]/schedule[]를 의도적으로 비움 — 교정 이슈로 올리지 않음(정책 안내는 registerPreviewPolicyNotes).
    if (calendarDataMissing && mode === 'confirm') {
      const detailBits = [
        !modetourSaveCoverage.saveCoverageDeparture ? '출발(날짜+성인가)' : null,
        !modetourSaveCoverage.saveCoveragePrice ? '가격(표·달력·priceFrom)' : null,
        !modetourSaveCoverage.saveCoverageSchedule ? '일정(일차 본문·itineraryDay)' : null,
      ]
        .filter(Boolean)
        .join(', ')
      flowFieldIssues.push({
        field: 'calendar',
        reason: `등록에 필요한 정보가 persisted 미리보기 결과에서 부족합니다(부족 축: ${detailBits || '항공·표 폴백 없음'}). 본문을 보완한 뒤 미리보기를 다시 실행하세요.`,
        source: 'auto',
      })
    }

    const departurePreviewRows = toDeparturePreviewRows(departureInputs)
    const selectedDepartureRow = departurePreviewRows.find((r) => r.isBookable === true) ?? departurePreviewRows[0] ?? null
    const supplierKey = normalizeSupplierOrigin(effectiveOriginSource)

    const calendarDep = selectedDepartureRow?.departureDate?.slice(0, 10) ?? null
    const factsFromRow = departurePreviewRowToKeyFacts(selectedDepartureRow)
    let heroResolvedPreview = resolveHeroTripDates({
      originSource: effectiveOriginSource,
      selectedDate: calendarDep,
      fallbackPriceRowDate: calendarDep,
      duration: parsed.duration,
      departureFacts: factsFromRow,
      modetourBodyHaystack: modetourHeroBodyHaystack('modetour', text),
    })
    let heroDepartureDate = heroResolvedPreview.departureIso
    let heroReturnDate = heroResolvedPreview.returnIso
    let heroDepartureDateSource = heroResolvedPreview.departureSource
    let heroReturnDateSource = heroResolvedPreview.returnSource

    const fsLegs = parsed.detailBodyStructured?.flightStructured
    if (supplierKey === 'modetour' && !heroDepartureDate && fsLegs?.outbound) {
      const ob = fsLegs.outbound
      const depIso = extractIsoDate([ob.departureDate, ob.departureTime].filter(Boolean).join(' '))
      if (depIso) {
        heroDepartureDate = depIso
        heroDepartureDateSource = 'modetour_flight_structured_outbound'
        heroResolvedPreview = resolveHeroTripDates({
          originSource: effectiveOriginSource,
          selectedDate: depIso,
          fallbackPriceRowDate: depIso,
          duration: parsed.duration,
          departureFacts: factsFromRow,
          modetourBodyHaystack: modetourHeroBodyHaystack('modetour', text),
        })
        heroReturnDate = heroResolvedPreview.returnIso
        heroReturnDateSource = heroResolvedPreview.returnSource
      }
    }
    if (
      supplierKey === 'modetour' &&
      Boolean(calendarDep || heroDepartureDate) &&
      !heroReturnDate &&
      fsLegs?.inbound
    ) {
      const ib = fsLegs.inbound
      const arrIso = extractIsoDate([ib.arrivalDate, ib.arrivalTime].filter(Boolean).join(' '))
      if (arrIso) {
        heroReturnDate = arrIso
        heroReturnDateSource = 'modetour_flight_structured_inbound_arrival'
      }
    }

    const heroDateFieldIssues: Array<{ field: string; reason: string; source: 'auto' | 'llm'; severity: 'info' | 'warn' }> =
      []
    const fsDbg = parsed.detailBodyStructured?.flightStructured?.debug
    const modetourFlightStructuredSuccess = fsDbg?.status === 'success'
    const flightHasUsableCore = modetourFlightHasUsableCore(factsFromRow, parsed)
    if (!flightHasUsableCore && !modetourFlightStructuredSuccess) {
      heroDateFieldIssues.push({
        field: 'flight_info',
        reason: '항공정보 검토 필요: 본문 자동 추출 값이 부분 누락되어 등록 후 편집에서 보정이 필요할 수 있습니다.',
        source: 'auto',
        severity: 'warn',
      })
    }
    if (supplierKey === 'modetour' && Boolean(calendarDep || heroDepartureDate) && !heroReturnDate) {
      heroDateFieldIssues.push({
        field: 'hero_trip_dates',
        reason:
          '귀국일(히어로): 달력·본문·항공 구조화에서 귀국(도착)일을 확정하지 못했습니다. 본문 일정·여행일수·귀국 항공 일자를 확인해 주세요.',
        source: 'auto',
        severity: 'warn',
      })
    }

    const extractionFieldIssuesRaw: RegisterExtractionFieldIssue[] = parsed.extractionFieldIssues ?? []
    const shoppingStopRowCount = countModetourShoppingStopsJsonRows(parsed.shoppingStops)
    const extractionFieldIssues = filterModetourExtractionIssuesForModetourRegister(extractionFieldIssuesRaw, {
      flightHasUsableCore: flightHasUsableCore || modetourFlightStructuredSuccess,
      shoppingStopRowCount,
    })
    parsed = { ...parsed, extractionFieldIssues }

    const combinedFieldIssues = [
      ...promotionFieldIssues,
      ...flowFieldIssues,
      ...heroDateFieldIssues,
      ...extractionFieldIssues,
    ]

    const priceDisplaySsot = buildPriceDisplaySsot(representativeCurrentSellingPrice, mergedPromotion)
    const priceDisplayValidation = validatePriceDisplaySsot(priceDisplaySsot)
    if (!priceDisplayValidation.ok) {
      for (const msg of priceDisplayValidation.errors) {
        combinedFieldIssues.push({
          field: 'priceDisplaySsot',
          reason: msg,
          source: 'auto',
          severity: 'warn',
        })
      }
    }
    for (const msg of priceDisplayValidation.warnings) {
      combinedFieldIssues.push({
        field: 'priceDisplaySsot',
        reason: msg,
        source: 'auto',
        severity: 'info',
      })
    }
    const baseRef = mergedPromotion.basePrice
    const saleRef = mergedPromotion.salePrice
    const hasBaseOnlyNoSale =
      baseRef != null &&
      Number.isFinite(baseRef) &&
      baseRef > 0 &&
      (saleRef == null || !Number.isFinite(saleRef) || saleRef <= 0)
    if (hasBaseOnlyNoSale) {
      combinedFieldIssues.push({
        field: 'pricePromotion.strikeThrough',
        reason:
          '병합 프로모에 salePrice가 없어 사용자 상세의 「쿠폰 적용 전(취소선)」 금액을 산출할 수 없어 숨겨집니다. (SSOT: 할인액은 base·sale 쌍이 있을 때만 추정) base만 있는 숫자는 등록·검수 참고용이며 사용자 노출 가격과 같지 않습니다.',
        source: 'auto',
        severity: 'info',
      })
    }
    timing.mark('after-extraction-issues')
    const representativePrice = priceDisplaySsot.selectedDeparturePrice ?? parsed.priceFrom ?? null
    const optionalTourDisplayNoticeFinal =
      optionalTourDisplayNoticeManual ??
      parsed.optionalTourDisplayNoticeFinal?.trim() ??
      '현지옵션은 현지에서 신청 후 진행되며, 비용과 진행 여부는 현지 기준에 따라 달라질 수 있습니다.'
    const parsedWithFinalNotice: RegisterParsed = normalizeModetourRegisterAdminTextareas({
      ...parsed,
      optionalTourDisplayNoticeManual,
      optionalTourDisplayNoticeFinal,
    })

    if (registerSnapshotId) {
      const registerAdminSnapshotStatus: RegisterAdminSnapshotStatus =
        calendarDataMissing && mode === 'confirm'
          ? REGISTER_ADMIN_SNAPSHOT_STATUS.review_required
          : REGISTER_ADMIN_SNAPSHOT_STATUS.normalized_ready
      const registerAdminReviewStateLlm =
        calendarDataMissing && mode === 'confirm' ? 'calendar_or_flow_issues' : 'clean'
      const registerAdminReviewStateTrusted =
        calendarDataMissing && mode === 'confirm' ? 'trusted_client_parsed' : 'clean'
      if (llmRanThisRequest && lastPipelineAnalysisId) {
        await persistRegisterAnalysisNormalizedFromParsed({
          snapshotId: registerSnapshotId,
          analysisId: lastPipelineAnalysisId,
          parsed: parsedWithFinalNotice,
          combinedFieldIssues,
          snapshotStatus: registerAdminSnapshotStatus,
          reviewState: registerAdminReviewStateLlm,
          timing,
        })
        timing.mark('after-analysis-status-save')
      } else if (!llmRanThisRequest && hasParsed && mode === 'confirm' && text.trim()) {
        const attemptNo = await nextRegisterAnalysisAttemptNo(prisma, registerSnapshotId)
        const row = await persistRegisterAnalysisTrustedClientParsedRecord({
          snapshotId: registerSnapshotId,
          attemptNo,
          parsed: parsedWithFinalNotice,
          combinedFieldIssues,
          snapshotStatus: registerAdminSnapshotStatus,
          reviewState: registerAdminReviewStateTrusted,
          timing,
        })
        lastPipelineAnalysisId = row.analysisId
        timing.mark('after-analysis-status-save')
      }
    }

    const productDraft = {
      originSource: effectiveOriginSource,
      originCode: parsed.originCode,
      supplierGroupId: parsed.supplierGroupId?.trim() || null,
      title: parsed.title,
      destinationRaw: parsed.destinationRaw?.trim() || parsed.destination?.trim() || null,
      primaryDestination: parsed.primaryDestination?.trim() || parsed.destination?.trim() || null,
      duration: parsed.duration,
      airline: parsed.airline ?? null,
      productType: parsed.productType || 'travel',
      airtelHotelInfoJson: parsed.airtelHotelInfoJson ?? null,
      airportTransferType: parsed.airportTransferType ?? null,
      optionalToursStructured: parsed.optionalToursStructured ?? null,
      optionalToursLlmSupplementJson: parsed.optionalToursLlmSupplementJson ?? null,
      optionalTourSummaryText: parsed.optionalTourSummaryText ?? null,
      hasOptionalTour: parsed.hasOptionalTour ?? null,
      optionalTourCount: parsed.optionalTourCount ?? null,
      optionalTourDisplayNoticeManual: optionalTourDisplayNoticeManual ?? null,
      optionalTourDisplayNoticeFinal,
      optionalToursCount: parsed.optionalTourCount ?? null,
      shoppingSummaryText: parsed.shoppingSummaryText ?? null,
      shoppingStopsCount:
        parsed.shoppingStops && typeof parsed.shoppingStops === 'string'
          ? (() => {
              try {
                const arr = JSON.parse(parsed.shoppingStops) as unknown[]
                return Array.isArray(arr) ? arr.length : null
              } catch {
                return null
              }
            })()
          : null,
      shoppingStopsLlmSupplementJson: parsed.shoppingStopsLlmSupplementJson ?? null,
      shoppingVisitCount: parsed.shoppingVisitCount ?? null,
      heroDepartureDate,
      heroDepartureDateSource,
      heroReturnDate,
      heroReturnDateSource,
      freeTimeSummaryText: parsed.freeTimeSummaryText ?? null,
      priceFrom: representativePrice,
      priceCurrency: parsed.priceCurrency?.trim() || null,
      selectedDeparturePrice: priceDisplaySsot.selectedDeparturePrice,
      couponDiscountAmount: priceDisplaySsot.couponDiscountAmount,
      displayPriceBeforeCoupon: priceDisplaySsot.displayPriceBeforeCoupon,
      displayFinalPrice: priceDisplaySsot.displayFinalPrice,
      currentSellingPrice: priceDisplaySsot.selectedDeparturePrice,
      discountAmount: priceDisplaySsot.couponDiscountAmount,
      compareAtPrice: priceDisplaySsot.displayPriceBeforeCoupon,
      promotionBasePrice: mergedPromotion.basePrice,
      promotionSalePrice: mergedPromotion.salePrice,
      productPriceTable: parsed.productPriceTable ?? null,
      priceTableRawText: parsed.priceTableRawText ?? null,
      airlineName: parsed.airlineName ?? null,
      routeRaw: parsed.routeRaw ?? null,
      hotelInfoRaw: nullIfEmptyTrim(parsed.hotelInfoRaw),
      hotelNames: normalizeStringList(parsed.hotelNames),
      dayHotelPlans: parsed.dayHotelPlans?.length ? parsed.dayHotelPlans : null,
      hotelSummaryText: nullIfEmptyTrim(parsedWithFinalNotice.hotelSummaryText),
      hotelStatusText: nullIfEmptyTrim(parsed.hotelStatusText),
      hotelNoticeRaw: nullIfEmptyTrim(parsed.hotelNoticeRaw),
      minimumDepartureCount: parsed.minimumDepartureCount ?? null,
      minimumDepartureText: parsed.minimumDepartureText ?? null,
      isDepartureGuaranteed: parsed.isDepartureGuaranteed ?? null,
      currentBookedCount: parsed.currentBookedCount ?? null,
      departureStatusText: parsed.departureStatusText ?? null,
      detailBodyStructured: parsed.detailBodyStructured ?? null,
    }
    timing.mark('after-normalize')

    const { buildRegisterPreviewSsotMeta } = await import('@/lib/register-preview-ssot-modetour')
    const ssotPreview = buildRegisterPreviewSsotMeta({
      draft: {
        selectedDeparturePrice: productDraft.selectedDeparturePrice ?? null,
        currentSellingPrice: productDraft.currentSellingPrice ?? null,
        priceFrom: productDraft.priceFrom ?? null,
        shoppingVisitCount: productDraft.shoppingVisitCount ?? null,
        shoppingStopsCount: productDraft.shoppingStopsCount ?? null,
        optionalToursStructured: productDraft.optionalToursStructured ?? null,
        optionalToursLlmSupplementJson: productDraft.optionalToursLlmSupplementJson ?? null,
      },
      geminiPromotion: geminiPm,
      sampleDeparture: selectedDepartureRow,
      fieldIssues: combinedFieldIssues,
      previewPolicyNotes: parsed.registerPreviewPolicyNotes ?? [],
    })

    const pricePromotionPreview = {
      merged: mergedPromotion,
      layers: {
        adapterDom: null,
        gemini: geminiPm,
        manualHtml: null,
        manualText: null,
      },
      fieldIssues: promotionFieldIssues,
      disclaimer: PRICE_PROMOTION_CONSULTING_DISCLAIMER,
    }

    const autoExtracted = {
      supplierLabel: earlySource,
      originUrl,
      adapterPrefetchRan: false,
      departureRowCount: departureInputs.length,
      urlSeed: null as { originCode: string; titleHint: string | null } | null,
      adapterSummaryPreview: '공통 등록 본류는 URL·어댑터 자동수집을 사용하지 않습니다.',
      pricePromotionFromAdapterDom: null,
    }

    const manualPasted = {
      mainTextLength: text.length,
      mainTextPreview: text.slice(0, 500),
      pastedBlocksPreview: pastedBlocks ?? null,
    }

    const geminiInferred = {
      ran: llmRanThisRequest,
      title: parsed.title,
      originCode: parsed.originCode,
      scheduleDayCount: (parsed.schedule ?? []).length,
      priceRowCount: (parsed.prices ?? []).length,
      productType: parsed.productType ?? null,
    }

    const calendarBlockedConfirm = mode === 'confirm' && !modetourCoveragePass
    if (calendarBlockedConfirm) {
      const errMsg =
        hasParsed || reusedConfirmAnalysis
          ? `저장 게이트: 출발·가격·일정 중 실질 데이터가 부족합니다(출발=${modetourSaveCoverage.saveCoverageDeparture}, 가격=${modetourSaveCoverage.saveCoveragePrice}, 일정=${modetourSaveCoverage.saveCoverageSchedule}). 미리보기를 다시 실행하세요.`
          : 'preview 분석 결과를 다시 불러오지 못했습니다. 동일 registerSnapshotId·registerAnalysisId로 미리보기를 다시 실행하세요.'
      return NextResponse.json(
        {
          success: false,
          code: 'REVIEW_REQUIRED',
          reviewRequired: true,
          registerSnapshotId,
          registerAnalysisId: lastPipelineAnalysisId,
          error: errMsg,
          fieldIssues: combinedFieldIssues,
        },
        { status: 422 }
      )
    }

    if (mode === 'preview') {
      stage = 'previewResponse'
      ctx.stage = stage
      const previewToken = issuePreviewToken(effectiveOriginSource, parsed.originCode)
      const previewContentDigest = computePreviewContentDigestForBody(body, forcedBrandKey)
      const { buildRegisterCorrectionPreview } = await import('@/lib/register-correction-preview-modetour')
      const parsedForPreview = stripRegisterInternalArtifacts(parsedWithFinalNotice)
      const correctionPreview = buildRegisterCorrectionPreview({
        parsed: parsedForPreview,
        productDraft,
        fieldIssues: combinedFieldIssues,
        ssotPreview,
        pastedBlocksPreview: manualPasted.pastedBlocksPreview,
        brandKey: forcedBrandKey,
      })
      const registerVerification = buildRegisterVerificationBundle({
        phase: 'preview',
        brandKey: forcedBrandKey,
        route: '/api/travel/parse-and-register-modetour',
        handler: 'parse-and-register-modetour-handler',
        parsed: parsedForPreview,
        productDraft,
        fieldIssues: combinedFieldIssues,
      })
      const previewPayload = {
        success: true as const,
        mode: 'preview' as const,
        previewToken,
        previewContentDigest,
        productDraft,
        departureDrafts: toDeparturePreviewRows(departureInputs),
        itineraryDayDrafts,
        parsed: parsedForPreview,
        pricePromotionPreview,
        autoExtracted,
        manualPasted,
        geminiInferred,
        fieldIssues: combinedFieldIssues,
        ssotPreview,
        correctionPreview,
        registerVerification,
        registerSnapshotId,
        registerAnalysisId: lastPipelineAnalysisId,
      }
      assertJsonSerializable(ctx, 'previewPayload', previewPayload)
      logParseAndRegister('ok', ctx)
      timing.mark('done')
      return NextResponse.json(previewPayload)
    }

    const scheduleJson = buildScheduleJson(schedule)

    stage = 'prismaFindProduct'
    ctx.stage = stage
    const existing = await prisma.product.findUnique({
      where: {
        originSource_originCode: {
          originSource: effectiveOriginSource,
          originCode: parsed.originCode,
        },
      },
      include: { prices: { orderBy: { date: 'asc' } } },
    })

    const benefitSummaryRaw =
      [mergedPromotion.benefitTitle, mergedPromotion.savingsText].filter(Boolean).join(' · ').slice(0, 500) || null
    const benefitSummary =
      normalizePromotionMarketingCopy(benefitSummaryRaw) ?? benefitSummaryRaw
    const promotionLabelsRawJoined =
      [mergedPromotion.couponText, mergedPromotion.couponCtaText, mergedPromotion.savingsText]
        .filter(Boolean)
        .join(' | ')
        .slice(0, 500) || null
    const promotionLabelsRaw =
      normalizePromotionMarketingCopy(promotionLabelsRawJoined) ?? promotionLabelsRawJoined

    const rawMetaForPromotion = mergeProductRawMetaPricePromotion(existing?.rawMeta ?? null, {
      merged: mergedPromotion,
      fieldIssues: promotionFieldIssues,
    })

    const hotelNamesLine = normalizeStringList(parsed.hotelNames).join(', ')
    const dayPlansBlock =
      parsed.dayHotelPlans?.length ?
        parsed.dayHotelPlans
          .map((p) => {
            const body = p.hotels?.length ? p.hotels.join('\n') : p.raw?.trim() || ''
            return [p.label, body].filter(Boolean).join('\n')
          })
          .join('\n\n')
      : null
    const hotelMiddle = dayPlansBlock || hotelNamesLine || null
    const hotelSummaryRawJoined =
      [nullIfEmptyTrim(parsed.hotelInfoRaw), hotelMiddle, nullIfEmptyTrim(parsed.hotelNoticeRaw), nullIfEmptyTrim(parsed.hotelStatusText)]
        .filter((x): x is string => typeof x === 'string' && x.length > 0)
        .join('\n')
        .slice(0, 4000) || null
    const normalizedHotelRaw = normalizeModetourHotelSummaryComposeBlock(hotelSummaryRawJoined)
    const hotelSummaryRaw =
      (normalizedHotelRaw ?? hotelSummaryRawJoined?.trim() ?? null)?.slice(0, 4000) || null

    /** 모두투어: 유의사항은 `mustKnowItems`만 — DB `reservationNoticeRaw`는 이 축에서 채우지 않음. */
    const reservationNoticeRaw = null

    const bookablePriceRows = (parsed.prices ?? []).filter((p) => isScheduleAdultBookable(p))
    const firstCalendarSample =
      bookablePriceRows.length > 0
        ? pickFirstCalendarSampleDate(effectiveOriginSource, bookablePriceRows)
        : null
    const heroAuditForMeta = resolveHeroTripDates({
      originSource: effectiveOriginSource,
      selectedDate: firstCalendarSample,
      fallbackPriceRowDate: firstCalendarSample,
      duration: parsed.duration,
      departureFacts: null,
      modetourBodyHaystack: modetourMetaHeroBodyHaystack(effectiveOriginSource, text),
    })

    const baseRawMeta = mergeRawMetaWithStructuredSignals(rawMetaForPromotion, parsedWithFinalNotice, {
      heroDepartureDateSource: heroAuditForMeta.departureSource,
      heroReturnDateSource: heroAuditForMeta.returnSource,
    })
    const registerListingMeta = travelScopeAndListingKindFromAdminRegister(travelScope)
    const productData = {
      originSource: effectiveOriginSource,
      originUrl,
      title: parsed.title,
      destination: parsed.destination,
      destinationRaw: parsed.destinationRaw?.trim() || parsed.destination?.trim() || null,
      primaryDestination: parsed.primaryDestination?.trim() || parsed.destination?.trim() || null,
      supplierGroupId: parsed.supplierGroupId?.trim() || null,
      priceFrom: representativePrice,
      priceCurrency: parsed.priceCurrency?.trim() || null,
      duration: parsed.duration,
      airline: parsed.airline ?? null,
      productType: parsed.productType || 'travel',
      airtelHotelInfoJson: parsed.airtelHotelInfoJson ?? null,
      hotelSummaryRaw,
      hotelSummaryText: nullIfEmptyTrim(parsedWithFinalNotice.hotelSummaryText),
      airportTransferType: parsed.airportTransferType ?? null,
      optionalToursStructured: parsed.optionalToursStructured ?? null,
      isFuelIncluded: parsed.isFuelIncluded !== false,
      isGuideFeeIncluded: parsed.isGuideFeeIncluded === true,
      mandatoryLocalFee: parsed.mandatoryLocalFee ?? null,
      mandatoryCurrency: parsed.mandatoryCurrency ?? null,
      includedText: parsedWithFinalNotice.includedText ?? null,
      excludedText: parsedWithFinalNotice.excludedText ?? null,
      counselingNotes: parsed.counselingNotes ? JSON.stringify(parsed.counselingNotes) : null,
      criticalExclusions: parsed.criticalExclusions ?? null,
      schedule: scheduleJson,
      registrationStatus: 'pending',
      benefitSummary,
      promotionLabelsRaw,
      reservationNoticeRaw,
      optionalTourSummaryRaw: parsed.optionalTourSummaryText ?? null,
      hasOptionalTours: parsed.hasOptionalTour ?? null,
      shoppingCount: parsed.shoppingVisitCount ?? null,
      shoppingVisitCountTotal: parsed.shoppingVisitCount ?? null,
      shoppingItems:
        parsed.shoppingStops && typeof parsed.shoppingStops === 'string'
          ? (() => {
              try {
                const arr = JSON.parse(parsed.shoppingStops) as Array<{ itemType?: unknown }>
                const items = arr
                  .map((x) => (typeof x?.itemType === 'string' ? x.itemType.trim() : ''))
                  .filter(Boolean)
                return items.length > 0 ? Array.from(new Set(items)).join(', ') : null
              } catch {
                return null
              }
            })()
          : null,
      shoppingShopOptions: parsed.shoppingStops ?? null,
      // 최소출발·예약현황은 Product 컬럼이 없는 DB와의 호환을 위해 rawMeta.structuredSignals만 사용 (mergeRawMetaWithStructuredSignals)
      rawMeta: baseRawMeta,
      ...registerListingMeta,
    }

    let productId: string

    stage = 'prismaConfirmWrite'
    ctx.stage = stage
    if (existing) {
      await prisma.$transaction(async (tx) => {
        await tx.productPrice.deleteMany({ where: { productId: existing.id } })
        await tx.itinerary.deleteMany({ where: { productId: existing.id } })
        await tx.product.update({
          where: { id: existing.id },
          data: productData,
        })
      })
      productId = existing.id
    } else {
      const created = await prisma.product.create({
        data: {
          ...productData,
          originCode: parsed.originCode,
        },
      })
      productId = created.id
    }
    timing.mark('after-pending-save')

    const sortedPrices = [...(parsed.prices ?? [])].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    let priceRows = modetourParsedCalendarRowsToProductPriceCreateMany(
      productId,
      sortedPrices,
      parsed.productPriceTable ?? null
    )
    if (priceRows.length === 0 && departureInputs.length > 0) {
      priceRows = modetourDepartureInputsToProductPriceCreateMany(
        productId,
        departureInputs,
        parsed.productPriceTable ?? null
      )
    }
    if (priceRows.length === 0 && parsed.productPriceTable) {
      const fallbackDate =
        departureInputs[0]?.departureDate instanceof Date
          ? departureInputs[0].departureDate
          : new Date()
      const adult = parsed.productPriceTable.adultPrice ?? parsed.priceFrom ?? 0
      priceRows = [
        {
          productId,
          date: fallbackDate,
          adult: adult > 0 ? adult : 0,
          childBed: parsed.productPriceTable.childExtraBedPrice ?? 0,
          childNoBed: parsed.productPriceTable.childNoBedPrice ?? 0,
          infant: parsed.productPriceTable.infantPrice ?? 0,
          priceGap: 0,
        },
      ]
    }
    if (priceRows.length > 0) {
      await prisma.productPrice.createMany({ data: priceRows })
    }
    timing.mark('after-prices-save')

    if (departureInputs.length > 0) {
      await upsertProductDepartures(prisma, productId, departureInputs)
    }
    timing.mark('after-departures-save')

    if (schedule.length > 0) {
      await prisma.itinerary.createMany({
        data: schedule.map((s: { day: number; title: string; description: string }) => ({
          productId,
          day: s.day,
          description: [s.title, s.description].filter(Boolean).join('\n\n') || String(s.day),
        })),
      })
    }

    if (itineraryDayDrafts.length > 0) {
      await upsertItineraryDays(prisma, productId, itineraryDayDrafts)
    }
    timing.mark('after-itinerary-save')

    await markRegisterAdminAnalysisPendingSavedWithTiming({
      analysisId: lastPipelineAnalysisId,
      snapshotId: registerSnapshotId,
      productId,
      timing,
    })

    stage = 'confirmResponse'
    ctx.stage = stage
    const parsedForConfirmResponse = stripRegisterInternalArtifacts(parsedWithFinalNotice)
    const registerVerification = buildRegisterVerificationBundle({
      phase: 'confirm',
      brandKey: forcedBrandKey,
      route: '/api/travel/parse-and-register-modetour',
      handler: 'parse-and-register-modetour-handler',
      parsed: parsedForConfirmResponse,
      productDraft,
      fieldIssues: combinedFieldIssues,
      productId,
      storedRawMetaJson: baseRawMeta,
    })
    const confirmPayload = {
      success: true as const,
      mode: 'confirm' as const,
      productId,
      parsed: parsedForConfirmResponse,
      message: existing ? '업데이트 완료' : '등록 완료',
      detailPath: `/admin/products/${productId}`,
      priceViewPath: `/products/${productId}`,
      registerVerification,
      adminTracePath: `/admin/products/${productId}?registerTrace=1`,
      registerSnapshotId,
      registerAnalysisId: lastPipelineAnalysisId,
    }
    assertJsonSerializable(ctx, 'confirmPayload', confirmPayload)
    logParseAndRegister('ok', ctx)
    timing.mark('done')
    return NextResponse.json(confirmPayload)
  } catch (e) {
    ctx.stage = stage
    logParseAndRegister('fail', ctx, e)
    const message = e instanceof Error ? e.message : '파싱 또는 등록 실패'
    return NextResponse.json(
      {
        success: false,
        error: message,
        ...(isDev ? { debug: devErrorDebug(ctx, e) } : {}),
      },
      { status: 500 }
    )
  }
}
