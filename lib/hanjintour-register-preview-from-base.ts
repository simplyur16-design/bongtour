/**
 * 한진투어 base 파싱 결과 → 관리자 등록 미리보기용 ybtour 호환 RegisterParsed / productDraft.
 * 항공·옵션·쇼핑 구조화는 정형 붙여넣기 칸 우선(`register-input-parse-ybtour`).
 */
import { createHash } from 'crypto'
import type { DetailBodyParseSnapshot } from '@/lib/detail-body-parser'
import type { OptionalToursStructured, ShoppingStructured } from '@/lib/detail-body-parser-types'
import {
  emptyFlightStructured,
  emptyOptionalToursStructured,
  emptyShoppingStructured,
} from '@/lib/detail-body-parser-input-axis-stubs'
import { buildRegisterVerificationBundle } from '@/lib/admin-register-verification-meta-ybtour'
import type { RegisterPreviewItineraryDay, RegisterPreviewProductDraft } from '@/lib/register-preview-payload-ybtour'
import type { RegisterPreviewFingerprintBlocks } from '@/lib/register-preview-content-fingerprint-ybtour'
import { buildRegisterPreviewCanonicalString } from '@/lib/register-preview-content-fingerprint-ybtour'
import {
  parseYbtourFlightInput,
  parseYbtourOptionalInput,
  parseYbtourShoppingInput,
} from '@/lib/register-input-parse-ybtour'
import { parseUnstructuredShoppingBodyForRegister } from '@/lib/register-input-unstructured-body-ybtour'
import { ybtourShoppingRowLooksPlausible } from '@/lib/register-ybtour-shopping'
import { resolveDirectedFlightLinesYbtour } from '@/lib/register-flight-ybtour'
import type { RegisterParsed } from '@/lib/register-llm-schema-ybtour'
import { stripRegisterInternalArtifacts } from '@/lib/register-llm-schema-ybtour'
import { mergeHanjintourFlightPaste } from '@/DEV/lib/hanjintour-flight-from-paste'
import {
  optionalTourRowsToSummary,
  parseHanjintourOptionalTourTableSsot,
} from '@/DEV/lib/hanjintour-optional-tours-from-table'
import { polishHanjintourScheduleDescriptions } from '@/DEV/lib/hanjintour-schedule-description-polish'
import type { HanjintourBaseParsedProduct, HanjintourOptionalTourStructuredRow } from '@/DEV/lib/hanjintour-types'

function visitCountFromPlausibleShoppingRows(rows: ShoppingStructured['rows']): number {
  const plausible = rows.filter(ybtourShoppingRowLooksPlausible)
  const nums = plausible.map((r) => r.visitNo).filter((x): x is number => x != null && Number.isFinite(x))
  const mx = nums.length > 0 ? Math.max(...nums) : 0
  return mx > 0 ? mx : plausible.length
}

/** 일정 본문 등에서 쇼핑 표·장소 근거가 있을 때만(단순 `쇼핑 N회` 라벨만으로는 미생성). */
function hanjintourShoppingStructuredFromScheduleEvidence(base: HanjintourBaseParsedProduct): ShoppingStructured | null {
  const chunks = base.schedule.map((d) => (d.description ?? '').trim()).filter(Boolean)
  const hay = chunks.join('\n\n')
  if (!hay.trim()) return null
  const structured = parseUnstructuredShoppingBodyForRegister(hay)
  const plausible = structured.rows.filter(ybtourShoppingRowLooksPlausible)
  if (plausible.length === 0) return null
  const vc = visitCountFromPlausibleShoppingRows(plausible)
  return {
    ...structured,
    rows: plausible,
    shoppingCountText: vc > 0 ? `쇼핑 ${vc}회` : '',
    reviewNeeded: structured.reviewNeeded,
    reviewReasons: structured.reviewReasons,
  }
}

/**
 * 한진투어 쇼핑 확정: 붙여넣기 칸이 SSOT.
 * - 붙여넣기 있음: `base.shopping_count`/본문 라벨은 확정에 사용하지 않음. 행·표 또는 `쇼핑 N회` 직접 입력만.
 * - 붙여넣기 없음: 일정 등 근거 행 없으면 비움.
 */
function hanjintourResolveShoppingRegisterFields(
  shop: ShoppingStructured,
  shopPasteTrimmed: string
): { shoppingVisitCount: number | null; shoppingSummaryText: string; hasShopping: boolean } {
  if (shopPasteTrimmed) {
    const pasteSingleCountLine = /^\s*쇼핑\s*(\d+)\s*회\s*$/u.test(shopPasteTrimmed)
    if (pasteSingleCountLine) {
      const m = shopPasteTrimmed.match(/쇼핑\s*(\d+)\s*회/u)
      if (m?.[1]) {
        const n = Number(m[1])
        if (Number.isFinite(n) && n > 0 && n < 100) {
          return { shoppingVisitCount: n, shoppingSummaryText: `쇼핑 ${n}회`, hasShopping: true }
        }
      }
    }
    const plausible = shop.rows.filter(ybtourShoppingRowLooksPlausible)
    if (plausible.length > 0) {
      const vc = visitCountFromPlausibleShoppingRows(plausible)
      const sum = shop.shoppingCountText.trim() || (vc > 0 ? `쇼핑 ${vc}회` : '')
      return {
        shoppingVisitCount: vc > 0 ? vc : null,
        shoppingSummaryText: sum,
        hasShopping: vc > 0,
      }
    }
    const m = shopPasteTrimmed.match(/쇼핑\s*(\d+)\s*회/u)
    if (m?.[1]) {
      const n = Number(m[1])
      if (Number.isFinite(n) && n > 0 && n < 100) {
        return { shoppingVisitCount: n, shoppingSummaryText: `쇼핑 ${n}회`, hasShopping: true }
      }
    }
    return { shoppingVisitCount: null, shoppingSummaryText: '', hasShopping: false }
  }
  const plausibleNoPaste = shop.rows.filter(ybtourShoppingRowLooksPlausible)
  if (plausibleNoPaste.length === 0) {
    return { shoppingVisitCount: null, shoppingSummaryText: '', hasShopping: false }
  }
  const vc = visitCountFromPlausibleShoppingRows(plausibleNoPaste)
  const sum = shop.shoppingCountText.trim() || (vc > 0 ? `쇼핑 ${vc}회` : '')
  return {
    shoppingVisitCount: vc > 0 ? vc : null,
    shoppingSummaryText: sum,
    hasShopping: vc > 0,
  }
}

export function pickPastedBlocksFromBody(body: Record<string, unknown>): RegisterPreviewFingerprintBlocks | null {
  const pb = body.pastedBlocks
  if (!pb || typeof pb !== 'object' || Array.isArray(pb)) return null
  const o = pb as Record<string, unknown>
  const out: RegisterPreviewFingerprintBlocks = {}
  for (const k of ['airlineTransport', 'hotel', 'optionalTour', 'shopping'] as const) {
    const v = o[k]
    if (typeof v === 'string' && v.trim()) out[k] = v.trim()
  }
  return Object.keys(out).length > 0 ? out : null
}

function hanjinOptionalRowsToOptionalToursStructured(
  rows: HanjintourOptionalTourStructuredRow[]
): OptionalToursStructured {
  return {
    rows: rows.map((r) => ({
      tourName: r.option_name.trim(),
      currency: r.currency ?? 'KRW',
      adultPrice: r.price_value,
      childPrice: null,
      durationText: r.duration_text ?? '',
      minPeopleText: '',
      guide同行Text: '',
      waitingPlaceText: '',
      descriptionText: '',
      alternateScheduleText: r.replacement_schedule ?? undefined,
      priceText: r.price_text,
      city: r.city,
      option_name: r.option_name,
      price_text: r.price_text,
      price_value: r.price_value,
      duration_text: r.duration_text,
      replacement_schedule: r.replacement_schedule,
    })) as OptionalToursStructured['rows'],
    reviewNeeded: false,
    reviewReasons: [],
  }
}

function buildHanjintourDetailBodySnapshot(args: {
  base: HanjintourBaseParsedProduct
  pasted: RegisterPreviewFingerprintBlocks | null
}): { detailBody: DetailBodyParseSnapshot; optionalSummaryFromSsot: string | null } {
  const air = (args.pasted?.airlineTransport ?? '').trim()
  const optPaste = (args.pasted?.optionalTour ?? '').trim()
  const shopPaste = (args.pasted?.shopping ?? '').trim()

  const flightStructured = air
    ? mergeHanjintourFlightPaste(parseYbtourFlightInput(air, null), air)
    : emptyFlightStructured()

  let optionalToursStructured: OptionalToursStructured
  let optionalSummaryFromSsot: string | null = null
  if (optPaste && /\t/u.test(optPaste)) {
    const ssot = parseHanjintourOptionalTourTableSsot(optPaste)
    if (ssot.length > 0) {
      optionalToursStructured = hanjinOptionalRowsToOptionalToursStructured(ssot)
      optionalSummaryFromSsot = optionalTourRowsToSummary(ssot)
    } else {
      const pasted = parseYbtourOptionalInput(optPaste)
      optionalToursStructured =
        pasted.rows.length > 0
          ? pasted
          : hanjinOptionalRowsToOptionalToursStructured(args.base.optional_tours_structured)
    }
  } else if (optPaste) {
    const pasted = parseYbtourOptionalInput(optPaste)
    optionalToursStructured =
      pasted.rows.length > 0
        ? pasted
        : hanjinOptionalRowsToOptionalToursStructured(args.base.optional_tours_structured)
  } else if (args.base.optional_tours_structured.length > 0) {
    optionalToursStructured = hanjinOptionalRowsToOptionalToursStructured(args.base.optional_tours_structured)
  } else {
    optionalToursStructured = emptyOptionalToursStructured()
  }

  const shoppingStructured = shopPaste
    ? parseYbtourShoppingInput(shopPaste, shopPaste)
    : hanjintourShoppingStructuredFromScheduleEvidence(args.base) ?? emptyShoppingStructured()

  const detailBody: DetailBodyParseSnapshot = {
    normalizedRaw: '',
    sections: [],
    review: { required: [], warning: [], info: [] },
    sectionReview: {},
    flightStructured,
    hotelStructured: { rows: [], reviewNeeded: false, reviewReasons: [] },
    optionalToursStructured,
    shoppingStructured,
    includedExcludedStructured: {
      includedItems: args.base.included_items,
      excludedItems: args.base.excluded_items,
      noteText: '',
      reviewNeeded: false,
      reviewReasons: [],
    },
    raw: {
      hotelPasteRaw: args.pasted?.hotel ?? null,
      optionalToursPasteRaw: optPaste || null,
      shoppingPasteRaw: shopPaste || null,
      flightRaw: air || null,
      hanatourReservationStatus: null,
    },
    brandKey: 'hanjintour',
  }
  return { detailBody, optionalSummaryFromSsot }
}

export function hanjintourScheduleToItineraryDrafts(schedule: RegisterParsed['schedule']): RegisterPreviewItineraryDay[] {
  return (schedule ?? []).map((s) => ({
    day: s.day,
    dateText: s.dateText ?? null,
    city: s.title?.replace(/^\d+\s*일차\s*/u, '').trim() || null,
    summaryTextRaw: s.description ?? '',
    poiNamesRaw: null,
    meals: s.mealSummaryText ?? null,
    accommodation: s.hotelText ?? null,
    hotelText: s.hotelText ?? null,
    breakfastText: s.breakfastText ?? null,
    lunchText: s.lunchText ?? null,
    dinnerText: s.dinnerText ?? null,
    mealSummaryText: s.mealSummaryText ?? null,
    transport: null,
    notes: null,
    rawBlock: null,
  }))
}

export function buildHanjintourRegisterParsed(args: {
  base: HanjintourBaseParsedProduct
  pasted: RegisterPreviewFingerprintBlocks | null
}): RegisterParsed {
  const { base, pasted } = args
  const { detailBody: detailBodyStructured, optionalSummaryFromSsot } = buildHanjintourDetailBodySnapshot({
    base,
    pasted,
  })
  const fs = detailBodyStructured.flightStructured
  const air = (pasted?.airlineTransport ?? '').trim()
  const segs = resolveDirectedFlightLinesYbtour(detailBodyStructured)
  const shopPasteTrimmed = (pasted?.shopping ?? '').trim()
  const shopFields = hanjintourResolveShoppingRegisterFields(
    detailBodyStructured.shoppingStructured,
    shopPasteTrimmed
  )
  const shopVc = shopFields.shoppingVisitCount
  const shopSum = shopFields.shoppingSummaryText
  const hasShop = shopFields.hasShopping

  const optRows = detailBodyStructured.optionalToursStructured.rows
  const optionalToursStructuredJson = optRows.length > 0 ? JSON.stringify({ rows: optRows }) : null

  const duration =
    base.trip_nights != null && base.trip_days != null
      ? `${base.trip_nights}박${base.trip_days}일`
      : base.trip_days != null
        ? `${base.trip_days}일`
        : ''

  return {
    originSource: 'hanjintour',
    originCode: base.product_code ?? 'UNKNOWN',
    title: base.product_title ?? '한진투어 상품',
    supplierListingTitleRaw: base.product_title,
    destination: '해외',
    destinationRaw: '해외',
    primaryDestination: null,
    supplierGroupId: null,
    productType: null,
    duration,
    schedule: polishHanjintourScheduleDescriptions(base.schedule, base.trip_days),
    prices: [],
    includedItems: base.included_items,
    excludedItems: base.excluded_items,
    includedText: base.included_items.length ? base.included_items.join('\n') : null,
    excludedText: base.excluded_items.length ? base.excluded_items.join('\n') : null,
    optionalToursStructured: optionalToursStructuredJson,
    optionalTourSummaryText:
      (optionalSummaryFromSsot ?? '').trim() ||
      (base.optional_tour_summary ?? '').trim() ||
      '',
    hasOptionalTour: optRows.length > 0,
    optionalTourCount: optRows.length,
    shoppingVisitCount: shopVc,
    shoppingSummaryText: shopSum,
    hasShopping: hasShop,
    priceFrom: base.base_price_adult ?? null,
    priceCurrency: 'KRW',
    productPriceTable: {
      adultPrice: base.base_price_adult,
      childExtraBedPrice: base.base_price_child,
      childNoBedPrice: null,
      infantPrice: base.base_price_infant,
    },
    priceTableRawText: base.price_table_raw_text,
    airlineName: air ? fs.airlineName : null,
    outboundFlightNo: fs.outbound.flightNo,
    inboundFlightNo: fs.inbound.flightNo,
    departureSegmentText: segs.departureSegmentFromStructured,
    returnSegmentText: segs.returnSegmentFromStructured,
    hotelSummaryText: base.hotel_summary,
    detailBodyStructured,
    registerPreviewPolicyNotes: [
      'hanjintour: 항공·선택관광·쇼핑은 정형칸·구조화 필드 우선. 쇼핑 횟수는 본문 라벨만으로 확정하지 않으며, 쇼핑 붙여넣기·일정 내 쇼핑 근거 행이 있을 때만 반영합니다.',
    ],
  } as RegisterParsed
}

export function buildHanjintourProductDraft(parsed: RegisterParsed): RegisterPreviewProductDraft {
  return {
    originSource: 'hanjintour',
    originCode: parsed.originCode,
    supplierGroupId: null,
    title: parsed.title,
    rawTitle: parsed.supplierListingTitleRaw ?? null,
    destinationRaw: parsed.destinationRaw ?? parsed.destination,
    primaryDestination: parsed.primaryDestination,
    duration: parsed.duration,
    airline: parsed.airlineName,
    optionalToursStructured: parsed.optionalToursStructured ?? null,
    optionalTourSummaryText: parsed.optionalTourSummaryText ?? null,
    hasOptionalTour: parsed.hasOptionalTour ?? null,
    optionalTourCount: parsed.optionalTourCount ?? null,
    shoppingVisitCount: parsed.shoppingVisitCount ?? null,
    priceFrom: parsed.priceFrom ?? null,
    priceCurrency: parsed.priceCurrency ?? 'KRW',
    productPriceTable: parsed.productPriceTable ?? null,
    priceTableRawText: parsed.priceTableRawText ?? null,
    airlineName: parsed.airlineName ?? null,
    outboundFlightNo: parsed.outboundFlightNo ?? null,
    inboundFlightNo: parsed.inboundFlightNo ?? null,
    departureSegmentText: parsed.departureSegmentText ?? null,
    returnSegmentText: parsed.returnSegmentText ?? null,
    hotelSummaryText: parsed.hotelSummaryText ?? null,
    detailBodyStructured: parsed.detailBodyStructured ?? null,
  } as RegisterPreviewProductDraft
}

export function computeHanjintourPreviewContentDigest(body: Record<string, unknown>): string {
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  let originUrl: string | null = typeof body.originUrl === 'string' ? body.originUrl.trim() : null
  if (originUrl === '') originUrl = null
  if (originUrl && originUrl.length > 2000) originUrl = originUrl.slice(0, 2000)
  const travelScope = typeof body.travelScope === 'string' ? body.travelScope.trim() : ''
  const pb = pickPastedBlocksFromBody(body)
  const pastedBlocksForFp = pb
    ? {
        airlineTransport: pb.airlineTransport,
        hotel: pb.hotel,
        optionalTour: pb.optionalTour,
        shopping: pb.shopping,
      }
    : undefined
  const canonical = buildRegisterPreviewCanonicalString({
    text,
    brandKey: 'hanjintour',
    originUrl,
    travelScope,
    pastedBlocks: pastedBlocksForFp,
  })
  return createHash('sha256').update(canonical, 'utf8').digest('base64url')
}

export function buildHanjintourRegisterVerificationPreview(args: {
  parsed: RegisterParsed
  productDraft: RegisterPreviewProductDraft
  phase?: 'preview' | 'confirm'
}) {
  const { parsed, productDraft, phase } = args
  return buildRegisterVerificationBundle({
    phase: phase ?? 'preview',
    brandKey: 'hanjintour',
    route: '/api/travel/parse-and-register-hanjintour',
    handler: 'handleParseAndRegisterHanjintourRequest',
    parsed,
    productDraft,
    fieldIssues: [],
  })
}

export function buildHanjintourPreviewResponseParts(args: {
  base: HanjintourBaseParsedProduct
  body: Record<string, unknown>
  text: string
  originUrl: string | null
}) {
  const pasted = pickPastedBlocksFromBody(args.body)
  const parsedRaw = buildHanjintourRegisterParsed({ base: args.base, pasted })
  const parsed = stripRegisterInternalArtifacts(parsedRaw)
  const productDraft = buildHanjintourProductDraft(parsed)
  const previewContentDigest = computeHanjintourPreviewContentDigest(args.body)
  const registerVerification = buildHanjintourRegisterVerificationPreview({ parsed, productDraft })
  const itineraryDayDrafts = hanjintourScheduleToItineraryDrafts(parsed.schedule)
  const pastedPreview =
    pasted != null
      ? {
          airlineTransport: pasted.airlineTransport ?? null,
          hotel: pasted.hotel ?? null,
          optionalTour: pasted.optionalTour ?? null,
          shopping: pasted.shopping ?? null,
        }
      : null
  return {
    parsed,
    productDraft,
    previewContentDigest,
    registerVerification,
    itineraryDayDrafts,
    manualPasted: {
      mainTextLength: args.text.length,
      mainTextPreview: args.text.slice(0, 800),
      pastedBlocksPreview: pastedPreview,
    },
    autoExtracted: {
      supplierLabel: '한진투어',
      originUrl: args.originUrl,
      adapterPrefetchRan: false,
      departureRowCount: 0,
      urlSeed:
        parsed.originCode && parsed.originCode !== 'UNKNOWN'
          ? { originCode: parsed.originCode, titleHint: parsed.title }
          : null,
      adapterSummaryPreview: args.base.parse_notes.slice(0, 12).join(' · ') || 'hanjintour base parse',
      pricePromotionFromAdapterDom: null,
    },
    geminiInferred: {
      ran: false,
      title: parsed.title,
      originCode: parsed.originCode,
      scheduleDayCount: parsed.schedule.length,
      priceRowCount: 0,
      productType: null,
    },
  }
}
