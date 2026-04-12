/**
 * Detail-body 스냅샷·섹션 타입 (공급사 비특정).
 *
 * **책임:** `detail-body-parser-*`는 정규화·앵커·슬라이스·호텔·포함불포함·일정 원료 경계 등 **본문 축**만 다룬다.
 * `flightStructured` / `optionalToursStructured` / `shoppingStructured`는 스냅샷 타입 호환을 위해 필드가 있으나,
 * 본문 파서 exit 시점에는 보통 빈 껍데기(`detail-body-parser-input-axis-stubs`)이고,
 * **항공·옵션·쇼핑 구조화 SSOT**는 `register-input-parse-*` + `register-parse-*`(정형 입력란)이다.
 */
export type DetailSectionType =
  | 'summary_section'
  | 'flight_section'
  | 'included_excluded_section'
  | 'schedule_section'
  | 'hotel_section'
  | 'optional_tour_section'
  | 'shopping_section'
  | 'notice_section'

export type FlightStructured = {
  airlineName: string | null
  outbound: {
    departureAirport: string | null
    departureAirportCode: string | null
    departureDate: string | null
    departureTime: string | null
    arrivalAirport: string | null
    arrivalAirportCode: string | null
    arrivalDate: string | null
    arrivalTime: string | null
    flightNo: string | null
    durationText: string | null
  }
  inbound: {
    departureAirport: string | null
    departureAirportCode: string | null
    departureDate: string | null
    departureTime: string | null
    arrivalAirport: string | null
    arrivalAirportCode: string | null
    arrivalDate: string | null
    arrivalTime: string | null
    flightNo: string | null
    durationText: string | null
  }
  rawFlightLines: string[]
  debug?: {
    candidateCount: number
    selectedOutRaw: string | null
    selectedInRaw: string | null
    partialStructured: boolean
    status: 'success' | 'partial' | 'failure'
    exposurePolicy: 'public_full' | 'public_limited' | 'admin_only'
    secondaryScanBlockCount?: number
    secondaryFlightSnippet?: string | null
    supplierBrandKey?: string | null
    expectFlightNumber?: boolean
    modetourParseTrace?: import('@/lib/flight-modetour-parser').ModetourParseTrace
  }
  reviewNeeded: boolean
  reviewReasons: string[]
}

export type HotelStructured = {
  rows: Array<{
    dayLabel: string
    dateText: string
    cityText: string
    bookingStatusText: string
    hotelNameText: string
    hotelCandidates: string[]
    noteText?: string
  }>
  reviewNeeded: boolean
  reviewReasons: string[]
}

export type OptionalToursStructured = {
  rows: Array<{
    tourName: string
    currency: string
    adultPrice: number | null
    childPrice: number | null
    durationText: string
    minPeopleText: string
    guide同行Text: string
    waitingPlaceText: string
    descriptionText: string
    noteText?: string
    /** 원문 비용 표기(예: 80,000, $55, 성인 USD 30 / 아동 USD 30) */
    priceText?: string
    /** 대체일정(본문 설명과 분리) */
    alternateScheduleText?: string
    /** 하나투어 전용: 스페셜포함, MD추천, [하나팩…] 등 */
    supplierTags?: string[]
    /** 하나투어: 스페셜포함 등 일정 포함·추가요금 없음 */
    includedNoExtraCharge?: boolean
  }>
  reviewNeeded: boolean
  reviewReasons: string[]
}

export type ShoppingStructured = {
  rows: Array<{
    shoppingItem: string
    shoppingPlace: string
    durationText: string
    refundPolicyText: string
    noteText?: string
    /** 하나투어 쇼핑 전용 입력란(구조화 붙여넣기) — 공개 JSON·프리뷰용 */
    city?: string | null
    shopName?: string | null
    shopLocation?: string | null
    itemsText?: string | null
    /** 노랑풍선(회차)·참좋은(구분) 표의 방문 번호 — 실제 방문 행일 때만 */
    visitNo?: number | null
    /** 모두투어(후보 그룹)·하나투어(후보 샵) 붙여넣기 — 행 수 ≠ 실제 쇼핑 횟수 */
    candidateOnly?: boolean
    /** 후보 그룹 식별(모두투어 등) */
    candidateGroupKey?: string | null
  }>
  shoppingCountText: string
  reviewNeeded: boolean
  reviewReasons: string[]
}

export type IncludedExcludedStructured = {
  includedItems: string[]
  excludedItems: string[]
  noteText: string
  reviewNeeded: boolean
  reviewReasons: string[]
}

/** 하나투어 예약현황 복합 한 줄(`예약 : N명 좌석 : M석 (최소출발 : …)`) — `detail-body-parser-hanatour` 추출. */
export type HanatourReservationStatusParsed = {
  sourceLine: string
  bookedPart: string | null
  seatsPart: string | null
  minDeparturePart: string | null
}

export type DetailBodyParseSnapshot = {
  normalizedRaw: string
  sections: Array<{ type: DetailSectionType; text: string }>
  review: {
    required: string[]
    warning: string[]
    info: string[]
  }
  sectionReview: Partial<
    Record<
      DetailSectionType,
      {
        required: string[]
        warning: string[]
        info: string[]
      }
    >
  >
  geminiRepairLog?: Partial<
    Record<
      DetailSectionType,
      { mode: 'always' | 'conditional' | 'skip'; triggered: boolean; applied: boolean; reason: string }
    >
  >
  qualityScores?: {
    hotelQualityScore: number
    optionalTourQualityScore: number
    shoppingQualityScore: number
    flightQualityScore: number
  }
  failurePatterns?: {
    hotel: string[]
    optionalTour: string[]
    shopping: string[]
    flight: string[]
  }
  flightStructured: FlightStructured
  hotelStructured: HotelStructured
  optionalToursStructured: OptionalToursStructured
  shoppingStructured: ShoppingStructured
  includedExcludedStructured: IncludedExcludedStructured
  raw: {
    hotelPasteRaw: string | null
    optionalToursPasteRaw: string | null
    shoppingPasteRaw: string | null
    flightRaw: string | null
    /** `brandKey === 'hanatour'`일 때만 채움. 가격/좌석 필드화는 등록 파이프가 소비. */
    hanatourReservationStatus?: HanatourReservationStatusParsed | null
  }
  brandKey?: string | null
}
