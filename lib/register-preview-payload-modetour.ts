/** [modetour] register-preview-payload */
import type { DeparturePreviewRow } from '@/lib/departure-preview'
import type { PricePromotionFieldIssue, PricePromotionSnapshot } from '@/lib/price-promotion-modetour'
import type { RegisterExtractionFieldIssue } from '@/lib/register-llm-schema-modetour'
import type { DayHotelPlan } from '@/lib/day-hotel-plans-modetour'
import type { RegisterPreviewSsotMeta } from '@/lib/register-preview-ssot-modetour'
import type { DetailBodyParseSnapshot } from '@/lib/detail-body-parser'
import type { RegisterCorrectionPreviewV1 } from '@/lib/register-correction-types-modetour'
import type { RegisterVerificationV1 } from '@/lib/admin-register-verification-meta-modetour'

/** 등록 API(`parse-and-register-*` 전용 + 잔여 공용) `mode: preview` 응답의 productDraft (필드는 엔드포인트와 동기화). */
export type RegisterPreviewProductDraft = {
  originSource: string
  originCode: string
  supplierGroupId: string | null
  title: string
  destinationRaw: string | null
  primaryDestination: string | null
  duration: string
  airline: string | null
  productType?: string | null
  airtelHotelInfoJson?: unknown
  airportTransferType?: string | null
  optionalToursStructured?: string | null
  /** Gemini 보조(저장 SSOT 아님) */
  optionalToursLlmSupplementJson?: string | null
  optionalTourSummaryText?: string | null
  hasOptionalTour?: boolean | null
  optionalTourCount?: number | null
  optionalTourDisplayNoticeManual?: string | null
  optionalTourDisplayNoticeFinal?: string | null
  optionalToursCount?: number | null
  shoppingStopsCount?: number | null
  /** Gemini 쇼핑 표 보조 */
  shoppingStopsLlmSupplementJson?: string | null
  /** 요약 방문 횟수(메타칩) — 표 row 수와 별개 */
  shoppingVisitCount?: number | null
  shoppingSummaryText?: string | null
  freeTimeSummaryText?: string | null
  /** SSOT: 달력 선택 출발·성인1인 가격 */
  selectedDeparturePrice?: number | null
  couponDiscountAmount?: number | null
  displayPriceBeforeCoupon?: number | null
  displayFinalPrice?: number | null
  /** 하위 호환 — SSOT와 동일 값 */
  currentSellingPrice?: number | null
  discountAmount?: number | null
  compareAtPrice?: number | null
  /** 미리보기 히어로 출발·귀국(검수용) — 사용자 상세와 동일 resolver */
  heroDepartureDate?: string | null
  heroDepartureDateSource?: string | null
  heroReturnDate?: string | null
  heroReturnDateSource?: string | null
  priceFrom: number | null
  priceCurrency: string | null
  /** 병합된 상단 프로모 가격(검수용) */
  promotionBasePrice?: number | null
  promotionSalePrice?: number | null
  productPriceTable?: {
    adultPrice?: number | null
    childExtraBedPrice?: number | null
    childNoBedPrice?: number | null
    infantPrice?: number | null
  } | null
  priceTableRawText?: string | null
  airlineName?: string | null
  departureSegmentText?: string | null
  returnSegmentText?: string | null
  outboundFlightNo?: string | null
  inboundFlightNo?: string | null
  routeRaw?: string | null
  /** 관리자 수동 항공 JSON (등록/편집 공통) */
  flightAdminJson?: string | null
  hotelInfoRaw?: string | null
  hotelNames?: string[]
  dayHotelPlans?: DayHotelPlan[] | null
  hotelSummaryText?: string | null
  hotelStatusText?: string | null
  hotelNoticeRaw?: string | null
  detailBodyStructured?: DetailBodyParseSnapshot | null
}

export type RegisterPreviewPricePromotion = {
  merged: PricePromotionSnapshot
  layers: {
    adapterDom: PricePromotionSnapshot | null
    gemini: PricePromotionSnapshot | null
    manualHtml: PricePromotionSnapshot | null
    manualText: PricePromotionSnapshot | null
  }
  fieldIssues: PricePromotionFieldIssue[]
  disclaimer: string
}

export type RegisterPreviewAutoExtracted = {
  supplierLabel: string
  originUrl: string | null
  adapterPrefetchRan: boolean
  departureRowCount: number
  urlSeed: { originCode: string; titleHint: string | null } | null
  adapterSummaryPreview: string
  pricePromotionFromAdapterDom: PricePromotionSnapshot | null
}

export type RegisterPreviewManualPasted = {
  mainTextLength: number
  mainTextPreview: string
  pastedBlocksPreview: Record<string, string> | null
}

export type RegisterPreviewGeminiInferred = {
  ran: boolean
  title: string
  originCode: string
  scheduleDayCount: number
  priceRowCount: number
  productType: string | null
}

export type RegisterPreviewItineraryDay = {
  day: number
  dateText?: string | null
  city?: string | null
  summaryTextRaw?: string | null
  poiNamesRaw?: string | null
  meals?: string | null
  accommodation?: string | null
  hotelText?: string | null
  breakfastText?: string | null
  lunchText?: string | null
  dinnerText?: string | null
  mealSummaryText?: string | null
  transport?: string | null
  notes?: string | null
  rawBlock?: string | null
}

/** POST `/api/travel/parse-and-register-…` 또는 잔여 `/api/travel/parse-and-register` — `mode: preview` JSON 본문 타입. */
export type RegisterPreviewPayload<Parsed = unknown> = {
  success: boolean
  mode: 'preview'
  /** confirm 시 필수. 미리보기 응답에서 받은 값을 그대로 전달 */
  previewToken?: string
  parsed: Parsed
  productDraft: RegisterPreviewProductDraft
  departureDrafts: DeparturePreviewRow[]
  itineraryDayDrafts: RegisterPreviewItineraryDay[]
  pricePromotionPreview?: RegisterPreviewPricePromotion
  autoExtracted?: RegisterPreviewAutoExtracted
  manualPasted?: RegisterPreviewManualPasted
  geminiInferred?: RegisterPreviewGeminiInferred
  /** 가격 프로모 이슈 + LLM 추출 SSOT 이슈(병합) */
  fieldIssues?: Array<PricePromotionFieldIssue | RegisterExtractionFieldIssue>
  /** 미리보기 SSOT 요약·배지(가격/쇼핑/선택관광/귀국) */
  ssotPreview?: RegisterPreviewSsotMeta
  /** 자동 스냅샷·이슈 근거·교정 UI 시드 (optional — 구형 클라이언트 무시) */
  correctionPreview?: RegisterCorrectionPreviewV1
  /** confirm 시 본문·블록 정합성 검증용 (미리보기 직후 입력과 다르면 저장 거부) */
  previewContentDigest?: string
  /** 공급사별 핸들러 주입: 실검증 패널(registerVerification) 구조화 요약 */
  registerVerification?: RegisterVerificationV1
}
