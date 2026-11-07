/**
 * 공급사 등록용 사실 번들 — 원문 일정표 복사 대신 LLM·미리보기에 넘기는 구조화 재료.
 * 저작권: 서술 문장은 LLM이 재작성하고, 여기는 도시·일차·가격·항공 등 사실만 담는다.
 */

export type SupplierRegisterFactSource =
  | 'modetour'
  | 'hanatour'
  | 'ybtour'
  | 'verygoodtour'
  | 'lottetour'
  | 'kyowontour'
  | 'naeiltour'

export type RegisterFactScheduleDay = {
  day: number
  places: string[]
  hotels: string[]
  meals: string[]
  transportNote: string | null
  /** 공급사 일차 원문 요약(있으면 description SSOT가 템플릿 대신 채택 시도) */
  supplierText?: string | null
  /**
   * 1일차 일정 본문(헤더 strong 제외)의 출발 줄. 예: "대구 공항 출발", "김해국제공항 출발".
   * 제목 허브와 이 줄이 다르면 출발지를 확정하지 않는다.
   */
  sourceDepartureBody?: string | null
  /** 문과장 1106: 관광지 카드 없이 원문 schdCatgNm=선택관광 카드로만 places 를 채운 일차 */
  optionalTourOnly?: boolean
  /**
   * 문과장 1106 v5: 관광 카드가 하나도 없는 이동·출발·귀국 일차에서만 — 원문 기타단문(SSCETC) 줄(serviceWITHSummary) 순서 그대로.
   * 지어낸 문장 없음. 관광 일차에는 채우지 않는다(기존 출력 불변).
   */
  supplierTimeline?: string[]
}

export type RegisterFactFlightLeg = {
  direction: 'outbound' | 'inbound' | 'unknown'
  carrier: string | null
  flightNo: string | null
  departureCity: string | null
  departureAt: string | null
  arrivalCity: string | null
  arrivalAt: string | null
}

export type RegisterFactPriceRow = {
  departureDate: string | null
  adultPrice: number | null
  childPrice: number | null
  infantPrice: number | null
  supplierDepartureCode: string | null
  /** 예약가능·출발확정·마감 등 공급사 원문 */
  statusRaw?: string | null
  /** 잔여N석 등 좌석 관련 원문 */
  seatsStatusRaw?: string | null
  seatCount?: number | null
  minPax?: number | null
  carrierName?: string | null
}

/**
 * RULE_A 달력 행이 비었을 때 — 미리보기 3슬롯·정책 안내용 (출발일 upsert에는 쓰지 않음).
 * 예: URL 출발 과거마감·modetour SD1.
 */
export type RegisterFactListingPriceSlots = {
  adultPrice: number | null
  childPrice: number | null
  infantPrice: number | null
  sourceDepartureDate: string | null
  unavailableReason: 'past_depart' | 'sd1' | 'calendar_empty'
}

export type SupplierRegisterFactBundle = {
  supplier: SupplierRegisterFactSource
  fetchedAt: string
  originUrl: string
  originCode: string | null
  title: string | null
  nights: number | null
  days: number | null
  meetingInfo: string | null
  includedBullets: string[]
  excludedBullets: string[]
  shoppingPlaces: string[]
  scheduleDays: RegisterFactScheduleDay[]
  flights: RegisterFactFlightLeg[]
  priceRows: RegisterFactPriceRow[]
  /** 달력 0건일 때 미리보기 가격표만 (confirm 출발행으로 승격하지 않음) */
  listingPriceSlots?: RegisterFactListingPriceSlots | null
  /** 디버그·추가 LLM 컨텍스트용 — 원문 HTML 전체는 넣지 않음 */
  notes: string[]
}
