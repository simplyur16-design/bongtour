/** [ybtour] register-llm-schema */
/**
 * 등록 LLM 입·출력 공용 타입·에러·strip만 유지한다.
 * Gemini 호출·프롬프트·병합 본체는 `register-from-llm-*.ts` 공급사별 파일을 사용한다.
 */
import type { DetailBodyParseSnapshot } from '@/lib/detail-body-parser'
import type { DayHotelPlan } from '@/lib/day-hotel-plans-ybtour'
import type { ParsedProductPrice } from './parsed-product-types'
import type { PricePromotionSnapshot } from './price-promotion-ybtour'
import type { RegisterPastedBlocksInput } from '@/lib/register-llm-blocks-ybtour'

export type DirectedFlightLineResolver = (
  detailBody: DetailBodyParseSnapshot
) => {
  departureSegmentFromStructured: string | null
  returnSegmentFromStructured: string | null
}

/** LLM JSON 1차/보정 단계 실패 — 핸들러에서 DB 분석 행에 기록 후 422 응답용 */
export class RegisterLlmParseError extends Error {
  readonly code = 'RegisterLlmParseError' as const
  finishReason: string | null
  repairAttempted: boolean
  repairFinishReason: string | null
  parseErrorMessage: string
  firstPassLlmRaw: string
  repairLlmRaw: string | null

  constructor(args: {
    message: string
    parseErrorMessage: string
    firstPassLlmRaw: string
    repairLlmRaw: string | null
    repairAttempted: boolean
    finishReason: string | null
    repairFinishReason: string | null
  }) {
    super(args.message)
    this.name = 'RegisterLlmParseError'
    this.parseErrorMessage = args.parseErrorMessage
    this.firstPassLlmRaw = args.firstPassLlmRaw
    this.repairLlmRaw = args.repairLlmRaw
    this.repairAttempted = args.repairAttempted
    this.finishReason = args.finishReason
    this.repairFinishReason = args.repairFinishReason
  }

  static is(e: unknown): e is RegisterLlmParseError {
    return e instanceof RegisterLlmParseError
  }
}

/** 추출 애매·충돌 시 미리보기·검수용 (가격 프로모 fieldIssues와 별도) */
export type RegisterExtractionFieldIssue = {
  field: string
  reason: string
  source: 'auto' | 'manual' | 'llm'
  severity: 'info' | 'warn'
}

/** Gemini 등록 추출 1차 JSON (`parseLlmJsonObject` 제네릭 — 필드 타이핑용) */
export type RegisterGeminiLlmJson = Record<string, unknown> & {
  originSource?: string
  originCode?: string
  title?: string
  destination?: string
  duration?: string
  airline?: string | null
  airlineName?: string | null
  departureSegmentText?: string | null
  returnSegmentText?: string | null
  outboundFlightNo?: string | null
  inboundFlightNo?: string | null
  departureDateTimeRaw?: string | null
  arrivalDateTimeRaw?: string | null
  routeRaw?: string | null
  isFuelIncluded?: boolean
  isGuideFeeIncluded?: boolean
  mandatoryLocalFee?: number | null
  mandatoryCurrency?: string | null
  priceTableRawText?: string | null
  priceTableRawHtml?: string | null
  productPriceTable?: Record<string, unknown> | null
  includedItems?: string[]
  excludedItems?: string[]
  includedRaw?: string | null
  excludedRaw?: string | null
  includedExcludedRaw?: string | null
  includedText?: string | null
  excludedText?: string | null
  singleRoomSurchargeAmount?: number | null
  singleRoomSurchargeCurrency?: string | null
  singleRoomSurchargeRaw?: string | null
  singleRoomSurchargeDisplayText?: string | null
  hasSingleRoomSurcharge?: boolean
  criticalExclusions?: string | null
  hotelInfoRaw?: string | null
  hotelNames?: string[]
  hotelStatusText?: string | null
  hotelNoticeRaw?: string | null
  dayHotelPlans?: Array<Record<string, unknown>>
  mustKnowRaw?: string | null
  mustKnowItems?: Array<Record<string, unknown>>
  meetingInfoRaw?: string | null
  meetingPlaceRaw?: string | null
  meetingNoticeRaw?: string | null
  meetingFallbackText?: string | null
  counselingNotes?: unknown
  schedule?: Array<{ day?: number; title?: string; description?: string; imageKeyword?: string }>
  prices?: Array<Record<string, unknown>>
  optionalTourNoticeRaw?: string | null
  optionalTourNoticeItems?: string[]
  optionalTourDisplayNoticeFinal?: string | null
  hasOptionalTour?: boolean
  optionalTourCount?: number
  optionalTourSummaryText?: string | null
  optionalTours?: Array<Record<string, unknown>>
  hasShopping?: boolean
  shoppingNoticeRaw?: string | null
  shoppingVisitCount?: number | null
  shoppingSummaryText?: string | null
  shoppingStops?: Array<Record<string, unknown>>
  hasFreeTime?: boolean
  freeTimeRawMentions?: string[]
  freeTimeSummaryText?: string | null
  fieldIssues?: unknown
  pricePromotion?: unknown
}

export type RegisterScheduleDay = {
  day: number
  /** 일차 상단 `YYYY.MM.DD` 또는 `YYYY년 M월 D일`에서 추출한 ISO 날짜(YYYY-MM-DD) */
  dateText?: string | null
  title: string
  description: string
  /** 실존하는 장소 명칭만 (Pexels 검색용 영문, 예: Osaka Castle) */
  imageKeyword: string
  hotelText?: string | null
  breakfastText?: string | null
  lunchText?: string | null
  dinnerText?: string | null
  mealSummaryText?: string | null
}

export type CalendarItem = {
  date: string
  adultPrice: number
  status: string
}

/** parse-and-register 확정 저장용 LLM 흔적(원문 텍스트 포함 가능) */
export type RegisterParseAudit = {
  capturedAt: string
  model: string
  finishReasonFirstPass: string | null
  firstPassLlmRaw: string
  repairAttempted: boolean
  repairFinishReason?: string | null
  repairLlmRaw?: string | null
  firstParseError?: string | null
  finalParseOk: true
}

export type RegisterParsed = {
  originSource: string
  originCode: string
  title: string
  destination: string
  /** 목적지 원문. 없으면 destination과 동일 */
  destinationRaw?: string | null
  /** 대표 목적지. 없으면 destination과 동일 */
  primaryDestination?: string | null
  /** 공급사 단체번호. TODO: 프롬프트에서 추출 또는 스크래퍼에서 채우기 */
  supplierGroupId?: string | null
  productType?: string | null
  airtelHotelInfoJson?: string | null
  airportTransferType?: string | null
  optionalToursStructured?: string | null
  /** Gemini 행이 표/regex와 다를 때 보조 보존(저장 SSOT 아님) */
  optionalToursLlmSupplementJson?: string | null
  optionalTourNoticeRaw?: string | null
  optionalTourNoticeItems?: string[]
  optionalTourDisplayNoticeManual?: string | null
  optionalTourDisplayNoticeFinal?: string | null
  hasOptionalTour?: boolean
  optionalTourCount?: number
  optionalTourSummaryText?: string
  shoppingNoticeRaw?: string | null
  shoppingStops?: string | null
  /** 표/regex 쇼핑 행과 다를 때 Gemini 표 보조 보존 */
  shoppingStopsLlmSupplementJson?: string | null
  hasShopping?: boolean
  shoppingVisitCount?: number | null
  shoppingSummaryText?: string
  hasFreeTime?: boolean
  freeTimeSummaryText?: string
  freeTimeRawMentions?: string[]
  headerBadges?: {
    optionalTour: string
    shopping: string
    freeTime: string
  }
  /** 대표 최저가(원). 첫 출발일 가격으로 채움 가능 */
  priceFrom?: number | null
  priceCurrency?: string | null
  duration: string
  airline?: string | null
  isFuelIncluded?: boolean
  isGuideFeeIncluded?: boolean
  mandatoryLocalFee?: number | null
  mandatoryCurrency?: string | null
  includedText?: string | null
  excludedText?: string | null
  singleRoomSurchargeAmount?: number | null
  singleRoomSurchargeCurrency?: string | null
  singleRoomSurchargeRaw?: string | null
  singleRoomSurchargeDisplayText?: string | null
  hasSingleRoomSurcharge?: boolean
  criticalExclusions?: string | null
  /** 상담용 AI 분석 (다른 플로우와 호환) */
  counselingNotes?: unknown | null
  schedule: RegisterScheduleDay[]
  prices: ParsedProductPrice[]
  calendar?: CalendarItem[]
  /** Gemini가 본문+수동 블록에서 추출한 상단 요금·혜택·쿠폰(정규화 시도) */
  pricePromotion?: PricePromotionSnapshot | null
  /** 본문 상품가격표 원문(우측 견적 카드와 혼동 금지) */
  priceTableRawText?: string | null
  priceTableRawHtml?: string | null
  /** 연령별 기본 단가(가격표가 SSOT일 때; 달력 행과 별도로 보존) */
  productPriceTable?: {
    adultPrice?: number | null
    childExtraBedPrice?: number | null
    childNoBedPrice?: number | null
    infantPrice?: number | null
  } | null
  /** 항공·구간 원문(상품 요약이 아닌 구조 필드) */
  airlineName?: string | null
  departureSegmentText?: string | null
  returnSegmentText?: string | null
  outboundFlightNo?: string | null
  inboundFlightNo?: string | null
  departureDateTimeRaw?: string | null
  arrivalDateTimeRaw?: string | null
  routeRaw?: string | null
  meetingInfoRaw?: string | null
  meetingPlaceRaw?: string | null
  meetingNoticeRaw?: string | null
  meetingFallbackText?: string | null
  includedItems?: string[]
  excludedItems?: string[]
  includedRaw?: string | null
  excludedRaw?: string | null
  includedExcludedRaw?: string | null
  hotelInfoRaw?: string | null
  hotelNames?: string[]
  /** 일차별 예정호텔(1일차 예정호텔 …) — 상세 호텔정보 탭 SSOT */
  dayHotelPlans?: DayHotelPlan[]
  /** 상품 전체 호텔 요약(예: 대표호텔명 외 1). 원문·LLM만, 없으면 undefined */
  hotelSummaryText?: string | null
  hotelStatusText?: string | null
  hotelNoticeRaw?: string | null
  extractionFieldIssues?: RegisterExtractionFieldIssue[]
  /**
   * 미리보기 전용. 필드 교정(extractionFieldIssues)이 아닌 정책 안내 — UI는 SSOT/가격 블록 안내문으로만 노출.
   */
  registerPreviewPolicyNotes?: string[]
  /** 꼭 확인하세요(여행 준비/입국 유의) — 상담 키워드 금지 */
  mustKnowRaw?: string | null
  mustKnowItems?: Array<{
    category:
      | '입국/비자'
      | '자녀동반'
      | '현지준비'
      | '안전/유의'
      | '국내준비'
      | '집결/탑승'
    title: string
    body: string
    raw?: string
  }>
  /** 꼭 확인하세요 데이터 출처 */
  mustKnowSource?: 'supplier' | 'supplier+web' | 'web' | null
  /** 검색 보완 시 안내 문구 */
  mustKnowNoticeRaw?: string | null
  /** 출발 조건(공급사 본문 추출) */
  minimumDepartureCount?: number | null
  minimumDepartureText?: string | null
  isDepartureGuaranteed?: boolean | null
  currentBookedCount?: number | null
  /** 본문 `잔여 N석` — 예약 인원과 구분 */
  remainingSeatsCount?: number | null
  departureStatusText?: string | null
  /** 본문 구조화 파서 스냅샷(raw/section/canonical/review) */
  detailBodyStructured?: DetailBodyParseSnapshot
  /**
   * 등록 확정 시 `Product.rawMeta.structuredSignals`에 병합되는 LLM 1차/보정 감사(응답 JSON에는 제외 권장).
   * `REGISTER_LLM_AUDIT_MAX_CHARS`(양수)로 문자열 상한 조절.
   */
  registerParseAudit?: RegisterParseAudit
  /** 관리자 등록 분석 DB용 LLM 병합 객체 JSON (API 응답에서 제외) */
  registerAdminPersistedLlmParsedJson?: string | null
}

/** API·클라이언트 응답용: 내부 감사·관리자 저장 전용 필드 제거 */
export function stripRegisterInternalArtifacts(p: RegisterParsed): RegisterParsed {
  const x = p as RegisterParsed & { registerAdminPersistedLlmParsedJson?: string | null }
  const { registerParseAudit: _a, registerAdminPersistedLlmParsedJson: _p, ...rest } = x
  return rest as RegisterParsed
}

/** 공급사별 `parseForRegisterLlm*`에 공통으로 넘기는 옵션(브랜드 문자열·스키마 모드는 각 전용 파일에 고정). */
export type RegisterLlmParseOptionsCommon = {
  originUrl?: string | null
  /** 상품유형 추론용: 실제 복붙 본문만 (없으면 제목 위주) */
  pastedBodyForInference?: string | null
  /** 관리자가 분리 입력한 붙여넣기 블록(선택) */
  pastedBlocks?: Partial<Omit<RegisterPastedBlocksInput, 'pastedBody'>> | null
  /** true: parse-and-register 미리보기 — LLM 출력 분량·지시 경량화 */
  forPreview?: boolean
  /** 공급사 전용 파이프라인이 미리 만든 detail-body (필수) */
  presetDetailBody?: DetailBodyParseSnapshot | null
  /** 가는/오는 편 문구 결정(공급사 전용 모듈에서 주입) */
  resolveDirectedFlightLines?: DirectedFlightLineResolver
  /**
   * true면 섹션별 Gemini repair 루프 생략.
   */
  skipDetailSectionGeminiRepairs?: boolean
  /** 섹션별 Gemini repair 최대 횟수(기본 3). */
  maxDetailSectionRepairs?: number
  llmCallMetrics?: { mainLlm: number; repairLlm: number; sectionRepairLlm: number }
  onTiming?: (label: string) => void
}
