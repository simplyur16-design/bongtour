/**
 * AI 파싱 결과 → 새 DB 스키마(Product, ProductPrice, Surcharge, Itinerary) 저장용 DTO
 */
export type ParsedProductPrice = {
  date: string // YYYY-MM-DD
  adultBase: number
  adultFuel: number
  childBedBase?: number
  childNoBedBase?: number
  childFuel: number
  infantBase?: number
  infantFuel: number
  status: '출발확정' | '예약가능' | '마감' | '대기예약'
  availableSeats: number
  /** 출발일별 항공·미팅 (상세에 명시될 때). 터미널 안내는 최종 항공 입력·구조화 항공값 기준. */
  carrierName?: string | null
  outboundFlightNo?: string | null
  outboundDepartureAirport?: string | null
  /** ISO8601 또는 파싱 가능한 문자열 → 적재 시 DateTime */
  outboundDepartureAt?: string | null
  outboundArrivalAirport?: string | null
  outboundArrivalAt?: string | null
  inboundFlightNo?: string | null
  inboundDepartureAirport?: string | null
  inboundDepartureAt?: string | null
  inboundArrivalAirport?: string | null
  inboundArrivalAt?: string | null
  meetingInfoRaw?: string | null
  meetingPointRaw?: string | null
  meetingTerminalRaw?: string | null
  meetingGuideNoticeRaw?: string | null
  /** 현지 가이드비 원문 (예: "30 USD") — sync UI 등 */
  localGuideFee?: string | null
  /** 1인당 싱글차지 등 */
  singleRoomExtra?: number | null
}

export type ParsedSurcharge = {
  minPax: number
  extraCharge: number
}

export type ParsedItinerary = {
  day: number
  description: string
}

/** 상담 안내 항목 (레벨 구분 없음) */
export type CounselingPoint = {
  title: string
  content: string
  script: string
}

export type CounselingNotesData = {
  counseling_points: CounselingPoint[]
}

/** SQLite 등에서 JSON을 문자열로 저장할 때 사용. DB 저장 시 JSON.stringify, 조회 시 이 함수로 파싱 */
export function parseCounselingNotes(raw: string | null): CounselingNotesData | null {
  if (raw == null) return null
  if (typeof raw !== 'string') return raw as CounselingNotesData
  try {
    return JSON.parse(raw) as CounselingNotesData
  } catch {
    return null
  }
}

export type ParsedProductForDB = {
  originSource: string
  originCode: string
  title: string
  destination: string
  /** 목적지 표기 원문 (A 상세). 없으면 destination과 동일 처리 가능 */
  destinationRaw?: string | null
  /** 대표 목적지 정규화값. 노출·필터용. 없으면 destination 사용 */
  primaryDestination?: string | null
  /** 공급사 단체번호/운영번호. TODO: 스크래퍼·B2B에서 채우기 */
  supplierGroupId?: string | null
  /** 상품 유형: travel | semi | private | airtel */
  productType?: string | null
  /** 에어텔 전용 호텔 상세 정보(JSON 저장 대상) */
  airtelHotelInfoJson?: string | null
  /** 공항 이동 포함 유형: NONE | PICKUP | SENDING | BOTH */
  airportTransferType?: string | null
  /** 구조화 현지옵션(JSON 문자열) */
  optionalToursStructured?: string | null
  /** 대표 최저가 원 단위. TODO: 출발일별 첫 가격 또는 A상세에서 추출 */
  priceFrom?: number | null
  /** 대표 가격 통화 (KRW 등) */
  priceCurrency?: string | null
  duration: string
  airline?: string
  /** 유류할증료 포함 여부 */
  isFuelIncluded?: boolean
  /** 가이드/기사 경비 포함 여부 */
  isGuideFeeIncluded?: boolean
  /** 현지 필수 지불액 (예: 30) */
  mandatoryLocalFee?: number | null
  /** 화폐 단위 (USD, EUR 등) */
  mandatoryCurrency?: string | null
  /** 포함 내역 전체 텍스트 */
  includedText?: string | null
  /** 불포함 내역 전체 텍스트 */
  excludedText?: string | null
  /** 상담용 AI 분석 (리스크 등급·스크립트) */
  counselingNotes?: CounselingNotesData | null
  /** 핵심 키워드 요약 (상담 시 즉시 확인용) */
  criticalExclusions?: string | null
  prices: ParsedProductPrice[]
  surcharges: ParsedSurcharge[]
  itineraries: ParsedItinerary[]
}
