/** [verygoodtour] admin-register-verification-meta */
/**
 * 관리자 등록 미리보기/confirm 실검증용 요약 JSON (공급사 핸들러에서만 주입).
 * 공용 register-parse 파이프라인과 분리.
 */
import { createHash } from 'crypto'
import type { RegisterParsed } from '@/lib/register-llm-schema-verygoodtour'
import type { RegisterPreviewProductDraft } from '@/lib/register-preview-payload-verygoodtour'
import type { PricePromotionFieldIssue } from '@/lib/price-promotion-verygoodtour'
import type { RegisterExtractionFieldIssue } from '@/lib/register-llm-schema-verygoodtour'
import { normalizeYbtourFlightLabelStrict } from '@/lib/text-encoding-guard'
import type { RegisterVerificationShoppingRowDisplay } from '@/lib/admin-register-verification-display-types'

export type RegisterVerificationV1 = {
  version: '1'
  phase: 'preview' | 'confirm'
  brandKey: string
  route: string
  handler: string
  debug: {
    hasFlightRaw: boolean
    hasFlightStructured: boolean
    flightStructuredStatus: string | null
    hotelRowCount: number
    optionalRowCount: number
    shoppingRowCount: number
    shoppingVisitCount: number | null
    productPriceTable: {
      adultPrice: number | null
      childExtraBedPrice: number | null
      childNoBedPrice: number | null
      infantPrice: number | null
    }
    priceSlotLabels: 'modetour_4slot' | 'default_3slot'
  }
  display: {
    flight: {
      airlineName: string | null
      outboundFlightNo: string | null
      inboundFlightNo: string | null
      departureSegmentText: string | null
      returnSegmentText: string | null
      outboundDepartureAirport: string | null
      outboundArrivalAirport: string | null
      outboundDepartureAt: string | null
      outboundArrivalAt: string | null
      inboundDepartureAirport: string | null
      inboundArrivalAirport: string | null
      inboundDepartureAt: string | null
      inboundArrivalAt: string | null
    }
    hotelRows: Array<{
      dayLabel: string
      dateText: string
      cityText: string
      hotelNameText: string
      bookingStatusText: string
    }>
    optionalRows: Array<{
      tourName: string
      adultPrice: number | null
      childPrice: number | null
      durationText: string
      minPaxText?: string | null
      alternateScheduleText?: string | null
      guide同行Text: string
      waitingPlaceText: string
    }>
    shopping: {
      visitCount: number | null
      rowCount: number
      rows: Array<RegisterVerificationShoppingRowDisplay>
    }
  }
  /** 공개 상세 비교 시 어떤 필드를 보면 되는지 */
  publicSourceHints: {
    flight: string
    price: string
    hotel: string
    optional: string
    shopping: string
  }
  /** fieldIssues → 교정/검수 시 추적 힌트 */
  fieldIssueTraces: Array<{
    field: string
    severity: string
    reason: string
    traceHint: string
    source: string
  }>
  /** 미리보기와 confirm 직후 parsed 기준 동일 알고리즘 해시(클라이언트에서 문자열 비교) */
  structuredFingerprint: string
  /** 미리보기 응답 fingerprint와 문자열 비교 */
  fingerprintCompareNote: string
  /** confirm 전용 */
  productId?: string
  storedStructuredSignalsPreview?: Record<string, unknown> | null
}

function traceHintForField(field: string): string {
  const f = field.toLowerCase()
  if (f === 'flight_info' || f.includes('flight'))
    return '근거: detailBodyStructured.raw.flightRaw, flightStructured.debug.status, 미리보기 departureDrafts 항공 요약, productDraft.departureSegmentText/returnSegmentText → 저장 시 rawMeta.structuredSignals에 동일 키 병합'
  if (f.includes('hero') && f.includes('date'))
    return '근거: 달력 샘플 출발일·일정 길이·항공 inbound 요약의 날짜 파싱 불일치 → 히어로 귀국일 resolver'
  if (f.includes('price') || f.includes('pricedisplay') || f.includes('promotion'))
    return '근거: 본문 가격표·productPriceTable·프로모 JSON 병합(SSOT) → 사용자 상세 가격 칩'
  if (f.includes('shopping'))
    return '근거: shopping 붙여넣기 또는 shopping_section, shoppingStructured.rows, shoppingVisitCount'
  if (f.includes('optional'))
    return '근거: optionalTour 붙여넣기 또는 optional_tour_section, optionalToursStructured JSON'
  if (f.includes('calendar'))
    return '근거: confirm 모드에서 prices[]/schedule[] 비어 있음 여부'
  return '근거: 미리보기 fieldIssues·ssotPreview·parsed.detailBodyStructured 교차 확인'
}

function combineDt(d: string | null | undefined, t: string | null | undefined): string | null {
  const dd = (d ?? '').trim()
  const tt = (t ?? '').trim()
  if (dd && tt) return `${dd} ${tt}`
  return dd || tt || null
}

function optionalRowsFromParsed(parsed: RegisterParsed): RegisterVerificationV1['display']['optionalRows'] {
  const raw = parsed.optionalToursStructured
  if (!raw || typeof raw !== 'string') return []
  try {
    const j = JSON.parse(raw) as { rows?: unknown[] }
    const rows = Array.isArray(j.rows) ? j.rows : []
    return rows.slice(0, 12).map((r) => {
      const o = r as Record<string, unknown>
      return {
        tourName: typeof o.tourName === 'string' ? o.tourName : '',
        adultPrice: typeof o.adultPrice === 'number' ? o.adultPrice : null,
        childPrice: typeof o.childPrice === 'number' ? o.childPrice : null,
        durationText: typeof o.durationText === 'string' ? o.durationText : '',
        minPaxText: typeof o.minPaxText === 'string' ? o.minPaxText : null,
        alternateScheduleText: typeof o.alternateScheduleText === 'string' ? o.alternateScheduleText : null,
        guide同行Text: typeof o.guide同行Text === 'string' ? o.guide同行Text : '',
        waitingPlaceText: typeof o.waitingPlaceText === 'string' ? o.waitingPlaceText : '',
      }
    })
  } catch {
    return []
  }
}

function fingerprintPayload(parsed: RegisterParsed, draft: RegisterPreviewProductDraft | null): string {
  const fs = parsed.detailBodyStructured?.flightStructured
  const ob = fs?.outbound
  const ib = fs?.inbound
  const hotel = parsed.detailBodyStructured?.hotelStructured?.rows ?? []
  const shop = parsed.detailBodyStructured?.shoppingStructured
  const opt = parsed.optionalToursStructured ?? ''
  const pt = draft?.productPriceTable ?? parsed.productPriceTable
  const payload = {
    airlineName: parsed.airlineName,
    obFn: parsed.outboundFlightNo,
    ibFn: parsed.inboundFlightNo,
    depSeg: parsed.departureSegmentText,
    retSeg: parsed.returnSegmentText,
    obAp: ob ? [ob.departureAirport, ob.arrivalAirport] : null,
    ibAp: ib ? [ib.departureAirport, ib.arrivalAirport] : null,
    price: pt
      ? {
          a: pt.adultPrice ?? null,
          ceb: pt.childExtraBedPrice ?? null,
          cnb: pt.childNoBedPrice ?? null,
          inf: pt.infantPrice ?? null,
        }
      : null,
    hotelSample: hotel.slice(0, 5).map((r) => ({
      d: r.dayLabel,
      dt: r.dateText,
      c: r.cityText,
      h: r.hotelNameText?.slice(0, 80),
    })),
    shopCount: shop?.rows?.length ?? 0,
    visit: draft?.shoppingVisitCount ?? parsed.shoppingVisitCount ?? null,
    optLen: opt.length,
  }
  return JSON.stringify(payload)
}

export function computeStructuredFingerprint(parsed: RegisterParsed, draft: RegisterPreviewProductDraft | null): string {
  const h = createHash('sha256').update(fingerprintPayload(parsed, draft), 'utf8').digest('hex')
  return h.slice(0, 20)
}

function ybtourVerificationFlightLabel(brandKey: string, s: string | null | undefined): string | null {
  if (brandKey !== 'ybtour') return s ?? null
  return normalizeYbtourFlightLabelStrict(s)
}

function mapFieldIssues(
  issues: Array<PricePromotionFieldIssue | RegisterExtractionFieldIssue>
): RegisterVerificationV1['fieldIssueTraces'] {
  return issues.map((it) => ({
    field: it.field,
    severity: 'severity' in it ? String(it.severity) : 'warn',
    reason: it.reason,
    traceHint: traceHintForField(it.field),
    source: 'source' in it ? String(it.source) : 'auto',
  }))
}

export function buildRegisterVerificationBundle(args: {
  phase: 'preview' | 'confirm'
  brandKey: string
  route: string
  handler: string
  parsed: RegisterParsed
  productDraft: RegisterPreviewProductDraft | null
  fieldIssues: Array<PricePromotionFieldIssue | RegisterExtractionFieldIssue>
  productId?: string
  /** confirm 직후 DB에 넣은 rawMeta JSON 문자열 */
  storedRawMetaJson?: string | null
}): RegisterVerificationV1 {
  const { parsed, productDraft, fieldIssues, phase, brandKey, route, handler, productId, storedRawMetaJson } = args
  const raw = parsed.detailBodyStructured?.raw
  const fs = parsed.detailBodyStructured?.flightStructured
  const ob = fs?.outbound
  const ib = fs?.inbound
  const hotelRows = parsed.detailBodyStructured?.hotelStructured?.rows ?? []
  const optRows = parsed.detailBodyStructured?.optionalToursStructured?.rows ?? []
  const shop = parsed.detailBodyStructured?.shoppingStructured
  const shopRows = shop?.rows ?? []
  const pt = productDraft?.productPriceTable ?? parsed.productPriceTable
  const fourSlot = brandKey === 'modetour'

  let storedStructuredSignalsPreview: Record<string, unknown> | null = null
  if (storedRawMetaJson) {
    try {
      const meta = JSON.parse(storedRawMetaJson) as { structuredSignals?: Record<string, unknown> }
      const sig = meta.structuredSignals
      if (sig && typeof sig === 'object' && !Array.isArray(sig)) {
        storedStructuredSignalsPreview = {
          airlineName: sig.airlineName,
          departureSegmentText: sig.departureSegmentText,
          returnSegmentText: sig.returnSegmentText,
          outboundFlightNo: sig.outboundFlightNo,
          inboundFlightNo: sig.inboundFlightNo,
          productPriceTable: sig.productPriceTable,
          flightRaw: typeof sig.flightRaw === 'string' ? `[${sig.flightRaw.length} chars]` : sig.flightRaw,
          hotelStructuredRowCount: Array.isArray((sig as { hotelStructured?: { rows?: unknown[] } }).hotelStructured?.rows)
            ? (sig as { hotelStructured: { rows: unknown[] } }).hotelStructured.rows.length
            : null,
          optionalTourCount: sig.optionalTourCount,
          shoppingVisitCount: sig.shoppingVisitCount,
        }
      }
    } catch {
      storedStructuredSignalsPreview = null
    }
  }

  return {
    version: '1',
    phase,
    brandKey,
    route,
    handler,
    debug: {
      hasFlightRaw: Boolean(raw?.flightRaw?.trim()),
      hasFlightStructured: Boolean(fs),
      flightStructuredStatus: fs?.debug?.status != null ? String(fs.debug.status) : null,
      hotelRowCount: hotelRows.length,
      optionalRowCount: optRows.length,
      shoppingRowCount: shopRows.length,
      shoppingVisitCount: productDraft?.shoppingVisitCount ?? parsed.shoppingVisitCount ?? null,
      productPriceTable: {
        adultPrice: pt?.adultPrice ?? null,
        childExtraBedPrice: pt?.childExtraBedPrice ?? null,
        childNoBedPrice: pt?.childNoBedPrice ?? null,
        infantPrice: pt?.infantPrice ?? null,
      },
      priceSlotLabels: fourSlot ? 'modetour_4slot' : 'default_3slot',
    },
    display: {
      flight: {
        airlineName: ybtourVerificationFlightLabel(
          brandKey,
          parsed.airlineName ?? productDraft?.airlineName ?? null
        ),
        outboundFlightNo: parsed.outboundFlightNo ?? null,
        inboundFlightNo: parsed.inboundFlightNo ?? null,
        departureSegmentText: ybtourVerificationFlightLabel(
          brandKey,
          parsed.departureSegmentText ?? productDraft?.departureSegmentText ?? null
        ),
        returnSegmentText: ybtourVerificationFlightLabel(
          brandKey,
          parsed.returnSegmentText ?? productDraft?.returnSegmentText ?? null
        ),
        outboundDepartureAirport: ob?.departureAirport ?? null,
        outboundArrivalAirport: ob?.arrivalAirport ?? null,
        outboundDepartureAt: combineDt(ob?.departureDate, ob?.departureTime),
        outboundArrivalAt: combineDt(ob?.arrivalDate, ob?.arrivalTime),
        inboundDepartureAirport: ib?.departureAirport ?? null,
        inboundArrivalAirport: ib?.arrivalAirport ?? null,
        inboundDepartureAt: combineDt(ib?.departureDate, ib?.departureTime),
        inboundArrivalAt: combineDt(ib?.arrivalDate, ib?.arrivalTime),
      },
      hotelRows: hotelRows.slice(0, 15).map((r) => ({
        dayLabel: r.dayLabel,
        dateText: r.dateText,
        cityText: r.cityText,
        hotelNameText: r.hotelNameText?.length > 120 ? `${r.hotelNameText.slice(0, 117)}…` : r.hotelNameText,
        bookingStatusText: r.bookingStatusText,
      })),
      optionalRows:
        optRows.length > 0
          ? optRows.slice(0, 12).map((r) => ({
              tourName: r.tourName,
              adultPrice: r.adultPrice,
              childPrice: r.childPrice,
              durationText: r.durationText,
              minPaxText: (r as { minPaxText?: string | null }).minPaxText ?? null,
              alternateScheduleText: (r as { alternateScheduleText?: string | null }).alternateScheduleText ?? null,
              guide同行Text: r.guide同行Text,
              waitingPlaceText: r.waitingPlaceText,
            }))
          : optionalRowsFromParsed(parsed),
      shopping: {
        visitCount: productDraft?.shoppingVisitCount ?? parsed.shoppingVisitCount ?? null,
        rowCount: shopRows.length,
        rows: shopRows.slice(0, 12).map((r) => ({
          shoppingItem: r.shoppingItem,
          shoppingPlace: r.shoppingPlace,
          durationText: r.durationText,
          refundPolicyText: r.refundPolicyText,
        })),
      },
    },
    publicSourceHints: {
      flight:
        '공개 상세: TravelProduct.rawMeta JSON → structuredSignals(항공 세그먼트·편명) + 출발일별 ProductDeparture facts 병합. 브랜드별 FlightStructuredBody 노출 정책 적용.',
      price:
        '공개 상세: ProductPrice 행(adult/childBed/childNoBed/infant) + 프로모/히어로 가격. 본문 productPriceTable은 rawMeta.structuredSignals에 저장.',
      hotel:
        '공개 상세: hotelSummaryRaw·dayHotelPlans·ItineraryDay 숙박 행. 구조화 행은 structuredSignals.hotelStructured 또는 등록 시 병합 필드.',
      optional:
        '공개 상세: Product.optionalToursStructured JSON + (있으면) structuredSignals 보조.',
      shopping:
        '공개 상세: shoppingShopOptions JSON + shoppingCount + structuredSignals 쇼핑 행.',
    },
    fieldIssueTraces: mapFieldIssues(fieldIssues),
    structuredFingerprint: computeStructuredFingerprint(parsed, productDraft),
    fingerprintCompareNote:
      phase === 'preview'
        ? 'confirm 응답의 structuredFingerprint와 비교하세요. 다르면 저장 요청 직전 parsed(교정·Pexels 등)가 미리보기와 달라진 것입니다.'
        : '직전 미리보기 응답의 structuredFingerprint와 비교하세요.',
    ...(productId ? { productId } : {}),
    ...(storedStructuredSignalsPreview != null ? { storedStructuredSignalsPreview } : {}),
  }
}

/** 관리자 상품 `?registerTrace=1` 등에서 공개 상세와 비교할 때 고정 안내 */
export const REGISTER_PUBLIC_PAGE_TRACE_BULLETS: readonly string[] = [
  '항공: 사용자 상세는 rawMeta.structuredSignals(항공 세그먼트·편명 등)와 출발일별 ProductDeparture 항공 필드를 합성하며, 브랜드별 FlightStructured 노출 정책이 추가로 적용됩니다.',
  '가격: ProductPrice 행(성인·아동침대·아동노침대·유아)과 히어로/프로모 표시. 본문 productPriceTable은 structuredSignals에 보존됩니다.',
  '호텔: hotelSummaryRaw·dayHotelPlans·ItineraryDay 숙박 텍스트와 structured hotel 행을 함께 봅니다.',
  '옵션: Product.optionalToursStructured JSON이 1차이며 structuredSignals 보조가 있을 수 있습니다.',
  '쇼핑: shoppingShopOptions JSON·shoppingCount·structured 쇼핑 행을 함께 봅니다.',
] as const
