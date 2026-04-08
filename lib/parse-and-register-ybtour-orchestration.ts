import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import {
  stripRegisterInternalArtifacts,
  type RegisterExtractionFieldIssue,
  type RegisterLlmParseOptionsCommon,
  type RegisterParsed,
  type RegisterScheduleDay,
} from '@/lib/register-llm-schema-ybtour'

/** hanatour/ybtour/잔여 공용 save 게이트: 달력 행만이 아니라 표·항공 구조화·일정 초안을 함께 본다. */
function registerPersistedHasCalendarDraftSignals(
  parsed: RegisterParsed,
  departureInputsLength: number,
  itineraryDayDraftsLength: number
): boolean {
  if (departureInputsLength > 0) return true
  if ((parsed.prices?.length ?? 0) > 0) return true
  if ((parsed.schedule?.length ?? 0) > 0) return true
  if (itineraryDayDraftsLength > 0) return true
  const t = parsed.productPriceTable
  if (
    t &&
    ((t.adultPrice != null && Number(t.adultPrice) > 0) ||
      (t.childExtraBedPrice != null && Number(t.childExtraBedPrice) > 0) ||
      (t.childNoBedPrice != null && Number(t.childNoBedPrice) > 0) ||
      (t.infantPrice != null && Number(t.infantPrice) > 0))
  ) {
    return true
  }
  if (Number(parsed.priceFrom) > 0) return true
  const fs = parsed.detailBodyStructured?.flightStructured
  if (!fs) return false
  const legOk = (l: typeof fs.outbound) =>
    Boolean(
      l?.flightNo?.trim() ||
        l?.departureDate?.trim() ||
        l?.departureTime?.trim() ||
        l?.departureAirport?.trim() ||
        l?.arrivalAirport?.trim()
    )
  const air = (fs.airlineName ?? '').trim()
  const airOk = Boolean(air && !/^항공예정$/i.test(air) && !/^항공\s*미정/i.test(air))
  return airOk || legOk(fs.outbound) || legOk(fs.inbound)
}
import { testGeminiConnection } from '@/lib/gemini-client'
import {
  parsedPricesToDepartureInputs,
  upsertProductDepartures,
  type DepartureInput,
} from '@/lib/upsert-product-departures-ybtour'
import { toDeparturePreviewRows } from '@/lib/departure-preview'
import {
  upsertItineraryDays,
  registerScheduleToDayInputs,
  type ItineraryDayInput,
} from '@/lib/upsert-itinerary-days-ybtour'
import { normalizeOriginSource } from '@/lib/supplier-origin'
import {
  buildPricePromotionFieldIssues,
  mergePricePromotionLayers,
  mergeProductRawMetaPricePromotion,
  parsePricePromotionFromGeminiJson,
  PRICE_PROMOTION_CONSULTING_DISCLAIMER,
  reconcilePromotionSalePriceWithAuthoritative,
  type PricePromotionFieldIssue,
} from '@/lib/price-promotion-ybtour'
import { issuePreviewToken, verifyPreviewToken } from '@/lib/registration-preview-token'
import { departureInputsToProductPriceCreateMany } from '@/lib/product-departure-to-price-rows-ybtour'
import { buildPriceDisplaySsot, validatePriceDisplaySsot } from '@/lib/price-display-ssot'
import { applyDepartureTerminalMeetingInfo } from '@/lib/meeting-terminal-rules'
import {
  attachPreservedMeetingOperatorToStructuredSignals,
  stripBodyDerivedMeetingFromRegisterParsed,
} from '@/lib/meeting-operator-ssot'
import type { RegisterPastedBlocksInput } from '@/lib/register-llm-blocks-ybtour'
import { nullIfEmptyTrim, normalizeStringList } from '@/lib/null-normalize'
import { mergeDayHotelPlansForRegister } from '@/lib/day-hotel-plans-ybtour'
import { normalizePromotionMarketingCopy } from '@/lib/promotion-copy-normalize'
import { addDaysIso, extractIsoDate, inferHeroReturnDayOffset } from '@/lib/hero-date-utils'
import { departurePreviewRowToKeyFacts } from '@/lib/product-hero-dates'
import { resolveYbtourHeroTripDates } from '@/lib/product-hero-ybtour'
import { isScheduleAdultBookable } from '@/lib/price-utils'
import {
  extractFlightLegAutoFromFlightStructured,
  mergeFlatFlightNoIntoAuto,
  mergeFlightManualCorrectionOnReparse,
  type FlightManualCorrectionPayload,
} from '@/lib/flight-manual-correction-ybtour'
import { buildRegisterPreviewCanonicalString } from '@/lib/register-preview-content-fingerprint-ybtour'
import {
  REGISTER_ADMIN_SNAPSHOT_STATUS,
  type RegisterAdminSnapshotStatus,
} from '@/lib/register-admin-audit-status-ybtour'
import { nextRegisterAnalysisAttemptNo } from '@/lib/register-admin-analysis-store-ybtour'
import {
  invokeRegisterParsePersistAnalysisAttempt,
  markRegisterAdminAnalysisPendingSavedWithTiming,
  persistRegisterAnalysisNormalizedFromParsed,
  persistRegisterAnalysisTrustedClientParsedRecord,
  resolveOrCreateRegisterAdminInputSnapshot,
} from '@/lib/register-admin-input-persist-ybtour'
import { tryLoadRegisterParsedForConfirmReuse } from '@/lib/register-admin-confirm-reuse-ybtour'
import { buildRegisterVerificationBundle } from '@/lib/admin-register-verification-meta-ybtour'
import type { RegisterPreviewProductDraft } from '@/lib/register-preview-payload-ybtour'
import { travelScopeAndListingKindFromAdminRegister } from '@/lib/register-admin-travel-category'
import { mergeYbtourDeterministicFieldsFromPaste } from '@/lib/ybtour-paste-deterministic-patch-ybtour'
import { extractYbtourTripAnchorsFromPaste } from '@/lib/ybtour-trip-anchors-from-paste-ybtour'
import { ybtourBuildMinimalDepartureInputs } from '@/lib/ybtour-synthetic-departure-ybtour'

type HeroTripDatesSupplement = Partial<Pick<Parameters<typeof resolveYbtourHeroTripDates>[0], 'ybtourFlightStructured'>>

function defaultReservationNoticeRawForProductSave(parsed: RegisterParsed): string | null {
  if ((parsed.mustKnowItems?.length ?? 0) > 0) return null
  const r = parsed.mustKnowRaw?.trim()
  return r ? r.slice(0, 6000) : null
}

/** ybtour 등록 preview/confirm 전용 오케스트레이션 — `handleParseAndRegisterYbtourRequest`만 연결. */
let currentLogPrefix = '[parse-and-register]'
const isDev = process.env.NODE_ENV === 'development'

/**
 * 노랑풍선 전용: 단계별 경과 시간을 항상 서버 로그에 남김(개발·운영 공통).
 * `parse-and-register-timing`은 dev에서만 출력하므로, 4분 지연 구간 특정용으로 별도 사용.
 */
function createYbtourRegisterTiming(logPrefix: string) {
  const t0 = Date.now()
  const devPrefix = `${logPrefix}[timing]`
  function mark(label: string) {
    if (process.env.DEV_YBTOUR_REGISTER_LOG !== '1') return
    const elapsed = Date.now() - t0
    console.info(`[ybtour][timing] ${label} +${elapsed}ms`)
    if (isDev) {
      console.log(`${devPrefix} ${label} +${elapsed}ms`)
    }
  }
  return { mark, t0 }
}

export type ParseAndRegisterFlowOptions = {
  /** 라우트 SSOT — 본 파일은 항상 `'ybtour'`만 허용, body.brandKey는 검증용(선택). */
  forcedBrandKey: 'ybtour'
  parseFn: (
    rawText: string,
    originSource?: string,
    options?: RegisterLlmParseOptionsCommon
  ) => Promise<RegisterParsed>
  logPrefix: string
  /** 공급사 전용: 파싱 직후·보강 후 parsed 정규화 */
  augmentParsed?: (
    parsed: RegisterParsed,
    ctx?: { pastedBodyText?: string }
  ) => RegisterParsed
  /**
   * augmentParsed 이후 한 번 더 패치(예: 하나투어 가격 행 합성). 브랜드 문자열 분기 없음 — 핸들러가 구현을 넘긴다.
   */
  patchParsedAfterAugment?: (parsed: RegisterParsed, pastedText: string) => RegisterParsed
  /**
   * true인 진입에서만 적용. confirm 시 raw 재파스·보강 LLM 금지는 각 핸들러가 이 플래그로 켠다.
   */
  savePersistedParsedOnly?: boolean
  /** `registerScheduleToDayInputs` 이후 itineraryDayDrafts를 schedule 기준으로 확정 */
  finalizeItineraryDayDraftsFromSchedule?: (
    drafts: ItineraryDayInput[],
    schedule: RegisterScheduleDay[]
  ) => ItineraryDayInput[]
  /**
   * confirm에서 출발일별 prices[] 행이 없으면 캘린더 신호를 실패로 보고 전용 이슈를 붙인다. 핸들러가 켠다.
   */
  strictConfirmDeparturePriceRows?: boolean
  /** `resolveYbtourHeroTripDates`에 합쳐 넣을 추가 인자(구조화 항공 blob 등). */
  getHeroTripDatesSupplement?: (parsed: RegisterParsed) => HeroTripDatesSupplement
  /** Product 저장 시 reservationNoticeRaw. 미지정이면 mustKnowItems/ mustKnowRaw 기본 규칙. */
  reservationNoticeRawForProductSave?: (parsed: RegisterParsed) => string | null
  /**
   * 선택: 출발·가격·항공 등 기본 캘린더 신호가 true여도, 일정 표현층이 없으면 확정을 막는다.
   */
  confirmScheduleExpressionLayerOk?: (parsed: RegisterParsed, drafts: ItineraryDayInput[]) => boolean
}

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
    optionalToursStructuredCanonical: parsed.detailBodyStructured?.optionalToursStructured ?? null,
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

function computePreviewContentDigestForBody(body: Record<string, unknown>): string {
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const brandKey = 'ybtour' as const
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

export async function runParseAndRegisterFlow(request: Request, flowOptions: ParseAndRegisterFlowOptions) {
  currentLogPrefix = flowOptions.logPrefix
  const {
    parseFn,
    forcedBrandKey,
    augmentParsed,
    patchParsedAfterAugment,
    savePersistedParsedOnly,
    finalizeItineraryDayDraftsFromSchedule,
    strictConfirmDeparturePriceRows,
    getHeroTripDatesSupplement,
    reservationNoticeRawForProductSave,
    confirmScheduleExpressionLayerOk,
  } = flowOptions
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

    const timing = createYbtourRegisterTiming(currentLogPrefix)
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
    const brandKeyFromBody = typeof body.brandKey === 'string' ? body.brandKey.trim() || null : null
    if (forcedBrandKey !== 'ybtour') {
      return NextResponse.json({ error: '내부 설정 오류: ybtour 전용 오케스트레이션입니다.' }, { status: 500 })
    }
    if (brandKeyFromBody && brandKeyFromBody !== 'ybtour' && brandKeyFromBody !== 'yellowballoon') {
      return NextResponse.json(
        {
          error: '요청 brandKey와 엔드포인트가 맞지 않습니다. 이 API에는 brandKey "ybtour"만 허용됩니다.',
        },
        { status: 400 }
      )
    }
    const brandKey = 'ybtour'
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
          error: '공급사 상세 본문을 붙여넣어 주세요. 공통 등록은 복붙 텍스트가 단일 입력(SSOT)이며, URL만으로 미리보기할 수 없습니다.',
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
    const llmCallMetrics = { mainLlm: 0, repairLlm: 0, sectionRepairLlm: 0 }
    let reusedConfirmAnalysis = false
    /** confirm에서 본문 전체 재분석(forPreview:false)을 한 번 수행했는지 — 오류 문구·이슈 분기용 */
    let ranConfirmSupplementalFullParse = false

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
          registerSnapshotId = sid
          lastPipelineAnalysisId = aid
          reusedConfirmAnalysis = true
          timing.mark('after-confirm-reuse-from-analysis')
        }
      }
    }

    if (savePersistedParsedOnly && mode === 'confirm' && !hasParsed && !reusedConfirmAnalysis) {
      console.info(`${flowOptions.logPrefix}[save-path]`, {
        brandKey: brandKey ?? forcedBrandKey,
        hasPersistedParsedResult: false,
        usedPersistedParsedResult: false,
        skippedRawReparseInSave: true,
        skippedRepairInSave: true,
        skippedMustKnowSupplementInSave: true,
        skippedConfirmSupplementalFullParse: true,
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
        maxDetailSectionRepairs: mode === 'preview' ? 2 : 3,
        llmCallMetrics,
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
        { error: '분석 결과를 불러오지 못했습니다. 미리보기를 다시 실행하거나 본문을 붙여넣은 뒤 분석하세요.' },
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
        const expected = computePreviewContentDigestForBody(body)
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
      if (savePersistedParsedOnly) {
        console.info(`${flowOptions.logPrefix}[save-path]`, {
          brandKey: brandKey ?? forcedBrandKey,
          hasPersistedParsedResult: hasParsed || reusedConfirmAnalysis,
          usedPersistedParsedResult: hasParsed || reusedConfirmAnalysis,
          skippedRawReparseInSave: !llmRanThisRequest,
          skippedRepairInSave: !llmRanThisRequest,
          skippedMustKnowSupplementInSave: !llmRanThisRequest,
          skippedConfirmSupplementalFullParse: true,
        })
      }
    }

    if (mode === 'confirm') {
      const scheduleEmpty = (parsed.schedule?.length ?? 0) === 0
      const pricesEmpty = (parsed.prices?.length ?? 0) === 0
      const reuseStale = hasParsed || reusedConfirmAnalysis
      /** 미리보기/스냅샷 재사용 시 빈 prices·schedule을 그대로 확정하지 않고, 단발 confirm에서도 일정·가격 누락 시 보강 */
      const shouldRunConfirmSupplementalFullParse =
        !savePersistedParsedOnly &&
        text.trim() &&
        ((reuseStale && (scheduleEmpty || pricesEmpty)) ||
          (!reuseStale && llmRanThisRequest && (scheduleEmpty || pricesEmpty)))

      if (shouldRunConfirmSupplementalFullParse) {
        stage = 'parseForRegisterConfirmSupplemental'
        ctx.stage = stage
        if (!registerSnapshotId) {
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
        const run2 = await invokeRegisterParsePersistAnalysisAttempt({
          snapshotId: registerSnapshotId,
          timing,
          parseFn,
          text,
          originSource,
          brandKey,
          originUrl,
          pastedBlocks,
          forPreview: false,
          skipDetailSectionGeminiRepairs: true,
          maxDetailSectionRepairs: 0,
          llmCallMetrics,
          onTiming,
        })
        timing.mark('after-confirm-supplemental-parseFn')
        if (!run2.ok) {
          logParseAndRegister('fail', ctx, run2.error)
          return NextResponse.json(
            {
              success: false,
              rawSaved: true,
              analysisFailed: true,
              registerSnapshotId,
              registerAnalysisId: run2.analysisId,
              error: run2.error.message,
              parseErrorMessage: run2.error.parseErrorMessage,
              repairAttempted: run2.error.repairAttempted,
              ...(isDev ? { debug: devErrorDebug(ctx, run2.error) } : {}),
            },
            { status: 422 }
          )
        }
        const fullParsed = run2.parsed
        lastPipelineAnalysisId = run2.analysisId
        llmRanThisRequest = true
        ranConfirmSupplementalFullParse = true
        const mergedSchedule =
          (fullParsed.schedule?.length ?? 0) > 0 ? fullParsed.schedule : (parsed.schedule ?? [])
        const mergedPrices =
          (fullParsed.prices?.length ?? 0) > 0 ? fullParsed.prices : (parsed.prices ?? [])
        parsed = {
          ...parsed,
          ...fullParsed,
          schedule: mergedSchedule,
          prices: mergedPrices,
          dayHotelPlans:
            (fullParsed.dayHotelPlans?.length ?? 0) > 0
              ? fullParsed.dayHotelPlans
              : (parsed.dayHotelPlans ?? []),
          ...(fullParsed.registerParseAudit ? { registerParseAudit: fullParsed.registerParseAudit } : {}),
        }
      }
      if (!(parsed.dayHotelPlans?.length)) {
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
    }

    if (augmentParsed) {
      parsed = augmentParsed(parsed, { pastedBodyText: text })
    }
    if (patchParsedAfterAugment) {
      parsed = patchParsedAfterAugment(parsed, text)
    }
    parsed = mergeYbtourDeterministicFieldsFromPaste(parsed, text)

    stage = 'buildRegisterDrafts'
    ctx.stage = stage
    parsed = stripBodyDerivedMeetingFromRegisterParsed(parsed)
    const schedule = parsed.schedule ?? []
    let departureFromParsed = parsedPricesToDepartureInputs(parsed.prices ?? [])
    let departureInputs: DepartureInput[] = applyDepartureTerminalMeetingInfo(departureFromParsed)
    const departureRowCountBefore = departureInputs.length
    const ybtourAnchors = extractYbtourTripAnchorsFromPaste(
      text,
      parsed.detailBodyStructured?.flightStructured ?? null
    )
    if (departureInputs.length === 0 && ybtourAnchors.tripStartIso) {
      departureInputs = applyDepartureTerminalMeetingInfo(
        ybtourBuildMinimalDepartureInputs(ybtourAnchors.tripStartIso, parsed, text)
      )
    }
    if (isDev && process.env.DEV_REGISTER_PERF_LOG === '1') {
      console.info('[register-ybtour]', {
        supplier: 'ybtour',
        mode,
        saveReuse: hasParsed || reusedConfirmAnalysis,
        llmCalled: llmRanThisRequest,
        tripStartSource: ybtourAnchors.tripStartSource,
        tripEndSource: ybtourAnchors.tripEndSource,
        itineraryCount: schedule.length,
        departureBefore: departureRowCountBefore,
        departureAfter: departureInputs.length,
        outboundFn: parsed.detailBodyStructured?.flightStructured?.outbound?.flightNo ?? null,
        inboundFn: parsed.detailBodyStructured?.flightStructured?.inbound?.flightNo ?? null,
        parseMs: Date.now() - timing.t0,
      })
    }

    let itineraryDayDrafts = registerScheduleToDayInputs(schedule ?? [])
    if (finalizeItineraryDayDraftsFromSchedule) {
      itineraryDayDrafts = finalizeItineraryDayDraftsFromSchedule(itineraryDayDrafts, schedule ?? [])
    }

    const geminiPm = parsePricePromotionFromGeminiJson(
      (parsed as { pricePromotion?: unknown }).pricePromotion
    )
    let mergedPromotion = mergePricePromotionLayers(null, geminiPm, null, null)

    /** 성인1인 출발가 후보: 달력 행 → 기본상품 성인 슬롯. 1인 객실 사용료 등 부가요금은 `singleRoomSurcharge*`·불포함 축만(가격 슬롯·이 값에 포함하지 않음). */
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

    let baseCalendarOk = registerPersistedHasCalendarDraftSignals(
      parsed,
      departureInputs.length,
      itineraryDayDrafts.length
    )
    if (mode === 'confirm' && strictConfirmDeparturePriceRows === true && departureInputs.length === 0) {
      baseCalendarOk = false
    }
    const scheduleExpressionLayerOk =
      confirmScheduleExpressionLayerOk?.(parsed, itineraryDayDrafts) ?? true
    const calendarSignalsOk = baseCalendarOk && scheduleExpressionLayerOk

    const flowFieldIssues: PricePromotionFieldIssue[] = []
    if (mode === 'confirm' && strictConfirmDeparturePriceRows === true && departureInputs.length === 0) {
      flowFieldIssues.push({
        field: 'hanatourPriceDepartureRows',
        reason:
          '하나투어 확정: 출발일별 가격 행(prices[])이 없습니다. `register-hanatour-price`로 기본상품 3슬롯을 채운 뒤에도 달력 행은 항공 등에서 출발일(ISO)이 있어야 합성됩니다. 출발일·가격표를 확인하세요.',
        source: 'auto',
      })
    }
    const calendarDataMissing = mode === 'confirm' && !calendarSignalsOk
    // 미리보기는 prices[]/schedule[]를 의도적으로 비움 — 교정 이슈로 올리지 않음(정책 안내는 registerPreviewPolicyNotes).
    if (calendarDataMissing && mode === 'confirm') {
      const layerOnlyFail = baseCalendarOk && !scheduleExpressionLayerOk
      flowFieldIssues.push({
        field: 'calendar',
        reason: layerOnlyFail
          ? '일정 표현층(일차별 일정·요약)이 비어 있어 확정할 수 없습니다. 본문에 일정표를 포함했는지 확인한 뒤 미리보기를 다시 실행하세요.'
          : savePersistedParsedOnly
            ? '등록에 필요한 출발·가격·일정 정보가 미리보기 결과에서 확인되지 않습니다. 본문에 해당 정보가 부족한 경우 본문을 보완하고, 이미 붙여넣었다면 미리보기를 다시 실행하세요.'
            : ranConfirmSupplementalFullParse
              ? '확정 단계 전체 재분석 후에도 출발·가격·일정 행이 비어 있습니다.'
              : hasParsed || reusedConfirmAnalysis
                ? '미리보기용 분석만 있어 저장용 일정·가격 행이 없습니다. 본문 전체 재분석이 필요합니다.'
                : '출발·가격·일정 데이터가 비어 있습니다. 본문(가격표·일정 구간)을 보완해 주세요.',
        source: 'auto',
      })
    }

    const extractionFieldIssues = parsed.extractionFieldIssues ?? []

    const heroTripDatesExtra = getHeroTripDatesSupplement?.(parsed) ?? {}

    const departurePreviewRows = toDeparturePreviewRows(departureInputs)
    const selectedDepartureRow = departurePreviewRows.find((r) => r.isBookable === true) ?? departurePreviewRows[0] ?? null
    const calendarDep = selectedDepartureRow?.departureDate?.slice(0, 10) ?? null
    const factsFromRow = departurePreviewRowToKeyFacts(selectedDepartureRow)
    const heroResolvedPreview = resolveYbtourHeroTripDates({
      selectedDate: calendarDep,
      fallbackPriceRowDate: calendarDep,
      duration: parsed.duration,
      departureFacts: factsFromRow,
      ybtourFlightStructured: heroTripDatesExtra.ybtourFlightStructured ?? null,
    })
    const heroDepartureDate = heroResolvedPreview.departureIso
    const heroReturnDate = heroResolvedPreview.returnIso
    const heroDepartureDateSource = heroResolvedPreview.departureSource
    const heroReturnDateSource = heroResolvedPreview.returnSource

    const heroDateFieldIssues: Array<{ field: string; reason: string; source: 'auto' | 'llm'; severity: 'info' | 'warn' }> =
      []
    if (calendarDep && factsFromRow?.inbound) {
      const listRet =
        extractIsoDate(factsFromRow.inbound.arrivalAtText) ||
        extractIsoDate(factsFromRow.inbound.departureAtText) ||
        null
      const off = inferHeroReturnDayOffset(parsed.duration)
      const durRet = off != null ? addDaysIso(calendarDep, off) : null
      if (listRet && durRet && listRet !== durRet) {
        heroDateFieldIssues.push({
          field: 'heroReturnDate',
          reason: `항공·달력 리스트 귀국일(${listRet})과 일정 길이 계산(${durRet})이 다릅니다. 사용자 상세는 리스트 우선 정책을 따릅니다.`,
          source: 'auto',
          severity: 'warn',
        })
      }
    }
    if (
      !factsFromRow?.inbound &&
      calendarDep &&
      heroReturnDateSource === 'duration_offset'
    ) {
      heroDateFieldIssues.push({
        field: 'heroReturnDate',
        reason: 'inbound 항공 행이 비어 귀국일을 일정(N박·N일)만으로 계산했습니다. 달력·본문 항공 구조화를 검수하세요.',
        source: 'auto',
        severity: 'info',
      })
    }
    const flightHasUsableCore =
      Boolean(factsFromRow?.airline?.trim()) &&
      Boolean((factsFromRow?.outboundSummary ?? '').trim() || (factsFromRow?.inboundSummary ?? '').trim())
    if (!flightHasUsableCore) {
      heroDateFieldIssues.push({
        field: 'flight_info',
        reason: '항공정보 검토 필요: 본문 자동 추출 값이 부분 누락되어 등록 후 편집에서 보정이 필요할 수 있습니다.',
        source: 'auto',
        severity: 'warn',
      })
    }

    const combinedFieldIssues = [...promotionFieldIssues, ...flowFieldIssues, ...extractionFieldIssues, ...heroDateFieldIssues]
    timing.mark('after-extraction-issues')

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
    const representativePrice = priceDisplaySsot.selectedDeparturePrice ?? parsed.priceFrom ?? null
    const optionalTourDisplayNoticeFinal =
      optionalTourDisplayNoticeManual ??
      parsed.optionalTourDisplayNoticeFinal?.trim() ??
      '현지옵션은 현지에서 신청 후 진행되며, 비용과 진행 여부는 현지 기준에 따라 달라질 수 있습니다.'
    const parsedWithFinalNotice: RegisterParsed = {
      ...parsed,
      optionalTourDisplayNoticeManual,
      optionalTourDisplayNoticeFinal,
    }

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
      } else if (
        reusedConfirmAnalysis &&
        mode === 'confirm' &&
        lastPipelineAnalysisId &&
        registerSnapshotId
      ) {
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
      hotelSummaryText: nullIfEmptyTrim(parsed.hotelSummaryText),
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

    const { buildRegisterPreviewSsotMeta } = await import('@/lib/register-preview-ssot-ybtour')
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

    const calendarBlockedConfirm = mode === 'confirm' && !calendarSignalsOk
    if (calendarBlockedConfirm) {
      const layerOnlyFail = baseCalendarOk && !scheduleExpressionLayerOk
      const emptyConfirmError = layerOnlyFail
        ? '일정 표현층(일차별 일정·요약)이 비어 있어 확정할 수 없습니다. 본문에 일정표를 포함했는지 확인한 뒤 미리보기를 다시 실행하세요.'
        : ranConfirmSupplementalFullParse
          ? '확정 단계에서 본문 전체 재분석을 수행했으나 출발·가격·일정 행이 비어 등록대기(Product)에 반영하지 않았습니다. 본문 가격표·일정·항공 구간을 확인한 뒤 다시 분석하세요.'
          : savePersistedParsedOnly && (hasParsed || reusedConfirmAnalysis)
            ? '본문에 출발·가격·일정 정보가 부족하거나, 미리보기 분석 결과에 해당 필드가 반영되지 않았습니다. 본문을 확인한 뒤 미리보기를 다시 실행하세요.'
            : savePersistedParsedOnly
              ? 'preview 분석 결과를 다시 불러오지 못했습니다. 동일 registerSnapshotId·registerAnalysisId로 미리보기를 다시 실행하세요.'
              : hasParsed || reusedConfirmAnalysis
                ? '저장용 분석 결과가 없습니다. 미리보기만으로는 확정할 수 없어 본문 전체 재분석이 필요합니다. 붙여넣기 본문을 유지한 채 [AI 실시간 분석] 후 다시 저장하세요.'
                : '출발·가격·일정 정규화 결과가 비어 있어 등록대기(Product)에 반영하지 않았습니다. 본문을 보완하거나 동일 registerSnapshotId로 재분석하세요.'
      return NextResponse.json(
        {
          success: false,
          code: 'REVIEW_REQUIRED',
          reviewRequired: true,
          registerSnapshotId,
          registerAnalysisId: lastPipelineAnalysisId,
          error: emptyConfirmError,
          confirmSupplementalFullParseRan: ranConfirmSupplementalFullParse,
          fieldIssues: combinedFieldIssues,
        },
        { status: 422 }
      )
    }

    if (mode === 'preview') {
      stage = 'previewResponse'
      ctx.stage = stage
      const previewToken = issuePreviewToken(effectiveOriginSource, parsed.originCode)
      const previewContentDigest = computePreviewContentDigestForBody(body)
      const { buildRegisterCorrectionPreview } = await import('@/lib/register-correction-preview-ybtour')
      const parsedForPreview = stripRegisterInternalArtifacts(parsedWithFinalNotice)
      const correctionPreview = buildRegisterCorrectionPreview({
        parsed: parsedForPreview,
        productDraft,
        fieldIssues: combinedFieldIssues,
        ssotPreview,
        pastedBlocksPreview: manualPasted.pastedBlocksPreview,
        brandKey,
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
        registerSnapshotId,
        registerAnalysisId: lastPipelineAnalysisId,
      }
      assertJsonSerializable(ctx, 'previewPayload', previewPayload)
      if (isDev) {
        console.info(currentLogPrefix, '[llm-metrics]', {
          ...llmCallMetrics,
          mode: 'preview',
          inputTextChars: text.length,
          elapsedMs: Date.now() - timing.t0,
        })
      }
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
    const hotelSummaryRaw =
      [nullIfEmptyTrim(parsed.hotelInfoRaw), hotelMiddle, nullIfEmptyTrim(parsed.hotelNoticeRaw), nullIfEmptyTrim(parsed.hotelStatusText)]
        .filter((x): x is string => typeof x === 'string' && x.length > 0)
        .join('\n')
        .slice(0, 4000) || null

    const reservationNoticeRaw = reservationNoticeRawForProductSave
      ? reservationNoticeRawForProductSave(parsed)
      : defaultReservationNoticeRawForProductSave(parsed)

    const bookablePriceRows = (parsed.prices ?? []).filter((p) => isScheduleAdultBookable(p))
    const firstCalendarSample =
      bookablePriceRows.length > 0 ? String(bookablePriceRows[0]!.date).slice(0, 10) : null
    const heroAuditForMeta = resolveYbtourHeroTripDates({
      selectedDate: firstCalendarSample,
      fallbackPriceRowDate: firstCalendarSample,
      duration: parsed.duration,
      departureFacts: null,
      ybtourFlightStructured: heroTripDatesExtra.ybtourFlightStructured ?? null,
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
      hotelSummaryText: nullIfEmptyTrim(parsed.hotelSummaryText),
      airportTransferType: parsed.airportTransferType ?? null,
      optionalToursStructured: parsed.optionalToursStructured ?? null,
      isFuelIncluded: parsed.isFuelIncluded !== false,
      isGuideFeeIncluded: parsed.isGuideFeeIncluded === true,
      mandatoryLocalFee: parsed.mandatoryLocalFee ?? null,
      mandatoryCurrency: parsed.mandatoryCurrency ?? null,
      includedText: parsed.includedText ?? null,
      excludedText: parsed.excludedText ?? null,
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
    let prevTotal = 0
    let priceRows = sortedPrices.map((p) => {
      const adultTotal = (p.adultBase ?? 0) + (p.adultFuel ?? 0)
      const fuel = Number(p.childFuel) || 0
      const childBedTotal =
        p.childBedBase != null ? (Number(p.childBedBase) || 0) + fuel : 0
      const childNoBedTotal =
        p.childNoBedBase != null ? (Number(p.childNoBedBase) || 0) + fuel : 0
      const infantTotal =
        p.infantBase != null || p.infantFuel != null
          ? (Number(p.infantBase) || 0) + (Number(p.infantFuel) || 0)
          : 0
      const priceAdult = adultTotal
      const priceChildWithBed = childBedTotal || null
      const priceChildNoBed = childNoBedTotal || null
      const priceInfant = infantTotal || null
      const total = priceAdult + (priceChildWithBed ?? 0) + (priceChildNoBed ?? 0) + (priceInfant ?? 0)
      const priceGap = prevTotal > 0 ? total - prevTotal : null
      prevTotal = total
      return {
        productId,
        date: new Date(p.date),
        adult: priceAdult,
        childBed: priceChildWithBed ?? 0,
        childNoBed: priceChildNoBed ?? 0,
        infant: priceInfant ?? 0,
        priceGap: priceGap ?? 0,
      }
    })
    if (priceRows.length === 0 && departureInputs.length > 0) {
      priceRows = departureInputsToProductPriceCreateMany(productId, departureInputs)
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

    stage = 'confirmResponse'
    ctx.stage = stage
    await markRegisterAdminAnalysisPendingSavedWithTiming({
      analysisId: lastPipelineAnalysisId,
      snapshotId: registerSnapshotId,
      productId,
      timing,
    })

    const stripped = stripRegisterInternalArtifacts(parsedWithFinalNotice)
    const registerVerification = buildRegisterVerificationBundle({
      phase: 'confirm',
      brandKey: forcedBrandKey,
      route: '/api/travel/parse-and-register-ybtour',
      handler: 'parse-and-register-ybtour-handler',
      parsed: stripped,
      productDraft: productDraft as RegisterPreviewProductDraft,
      fieldIssues: combinedFieldIssues as Array<PricePromotionFieldIssue | RegisterExtractionFieldIssue>,
      productId,
      storedRawMetaJson: baseRawMeta,
    })
    const confirmPayload = {
      success: true as const,
      mode: 'confirm' as const,
      productId,
      /** HTTP 응답 부피 절감: 전체 parsed 대신 요약만. 상세는 DB·관리자 상품 화면에서 조회. */
      parsedSummary: {
        originCode: stripped.originCode,
        title: stripped.title,
        destination: stripped.destination ?? null,
        duration: stripped.duration ?? null,
      },
      message: existing ? '업데이트 완료' : '등록 완료',
      detailPath: `/admin/products/${productId}`,
      priceViewPath: `/products/${productId}`,
      registerVerification,
      adminTracePath: `/admin/products/${productId}?registerTrace=1`,
      registerSnapshotId,
      registerAnalysisId: lastPipelineAnalysisId,
    }
    assertJsonSerializable(ctx, 'confirmPayload', confirmPayload)
    if (isDev) {
      console.info(currentLogPrefix, '[llm-metrics]', {
        ...llmCallMetrics,
        mode: 'confirm',
        reusedConfirmAnalysis,
        inputTextChars: text.length,
        elapsedMs: Date.now() - timing.t0,
      })
    }
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
