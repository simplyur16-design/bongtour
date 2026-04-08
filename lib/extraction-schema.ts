/**
 * AI 추출 시 반드시 준수할 JSON 스키마.
 * B2B 여행사 관리자 관점: 돈·팩트만 추출, 광고 문구 배제.
 */

/** B2B 추출 결과 (Gemini 원시 출력) */
export type BrandDetected =
  | '하나투어'
  | '모두투어'
  | '노랑풍선'
  | '참좋은여행'
  | '기타'

export type ExtractedB2BBrand = {
  detected: BrandDetected
  productCode: string
}

export type ExtractedB2BPriceInfo = {
  adult: number
  child: number
  currency: string
}

export type ExtractedB2BGuideFee = {
  amount: number
  currency: string
}

export type ExtractedB2BOptionalTour = {
  name: string
  price: number
  currency: string
  isWaiting: boolean
}

export type ExtractedB2BOnSiteBudget = {
  mandatoryGuideFee: ExtractedB2BGuideFee
  shoppingCount: number
  shoppingItems: string[]
  optionalTours: ExtractedB2BOptionalTour[]
}

export type ExtractedB2B = {
  brand: ExtractedB2BBrand
  priceInfo: ExtractedB2BPriceInfo
  onSiteBudget: ExtractedB2BOnSiteBudget
  routeSummary: string[]
  legalDisclaimer: string
  /** 앱/DB 연동용 (원문에 있으면 채움) */
  productName?: string
  groupNumber?: string
  airline?: string
  primaryDestination?: string
}

export type ExtractedOptionalTour = {
  name: string
  priceUsd: number
  duration?: string
  waitPlaceIfNotJoined?: string
}

export type ExtractedItineraryDay = {
  day: number
  title: string
  items: string[]
}

export type ExtractedDailyPrice = {
  date: string
  price: string
}

/** 출발 날짜별 가격 및 예약 상태 */
export type ExtractedPriceItem = {
  date: string
  price: string
  status?: '예약가능' | '대기' | '마감'
}

/** 쇼핑·가이드경비·현지옵션 팩트체크 */
export type ExtractedFactCheck = {
  shoppingCount: number
  shoppingItems?: string
  guideFeeUsd?: number
  optionalTours: ExtractedOptionalTour[]
}

export type ExtractedProduct = {
  productName: string
  productTitle?: string
  airline: string
  productCode: string
  groupNumber: string
  brandName?: string
  /** 이 상품의 핵심 여행지명 하나 (예: 다낭, 방콕). 이미지 URL은 사용하지 않고 이 값으로 대표 이미지 조회 */
  primaryDestination?: string
  dailyPrices: ExtractedDailyPrice[]
  /** 출발 날짜별 가격 및 예약 상태 (예약가능/대기/마감) */
  priceList?: ExtractedPriceItem[]
  shoppingCount: number
  shoppingItems?: string
  guideFeeNote?: string
  guideFeeUsd?: number
  optionalTours: ExtractedOptionalTour[]
  itinerary: ExtractedItineraryDay[]
  /** 쇼핑·가이드경비·현지옵션 (priceList/factCheck 있으면 우선 사용) */
  factCheck?: ExtractedFactCheck
}

// ---------------------------------------------------------------------------
// 여행 데이터 파싱 엔지니어: 연령별 가격·날짜별 좌석·현지비 (실시간 가격/예약 계산용)
// ---------------------------------------------------------------------------

export type ExtractedPriceTier = {
  base: number
  fuel: number
  total: number
}

export type ExtractedPricingByAge = {
  adult: ExtractedPriceTier
  child_bed?: ExtractedPriceTier
  child_nobed?: ExtractedPriceTier
  infant?: ExtractedPriceTier
}

export type ExtractedGroupModifier = {
  min_pax: number
  extra: number
}

export type ExtractedDailyScheduleItem = {
  date: string
  status: '출발확정' | '예약가능' | '대기예약' | '마감'
  seats?: number
  pricing: ExtractedPricingByAge
  modifiers?: ExtractedGroupModifier[]
  single_room_extra?: number
  local_guide_fee?: string
  /** 모두투어 등 상세에 출발일별로 명시될 때만 (원문 우선, 없으면 생략) */
  carrierName?: string | null
  outboundFlightNo?: string | null
  outboundDepartureAirport?: string | null
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
}

export type ExtractedPricingSchedule = {
  product_code: string
  daily_schedule: ExtractedDailyScheduleItem[]
}

/** 가격/날짜/좌석 추출용 프롬프트 (하나투어·모두투어 상세페이지) */
export const EXTRACTION_JSON_SCHEMA_PRICING = `
# Role: 전문 여행 데이터 파싱 엔지니어 (Travel Data Extraction Expert)

# Context
하나투어, 모두투어 상세 페이지에서 긁어온 비정형 텍스트를 분석하여, Bong투어 시스템의 DB 구조(JSON)로 정밀 변환한다. 실시간 가격 연동 및 예약 계산기에 사용되므로 수치 오류는 절대 허용하지 않는다.

# Instructions

## 1. 연령별 가격 및 유류세 (Price Parsing)
- 성인(adult): 기본가 + 유류할증료(제세공과금) 합산 → total.
- 아동 베드(child_bed): 별도 표기 없으면 성인가 적용.
- 아동 노베드(child_nobed): "노베드", "침대 미사용" 조건 가격. 없으면 성인가 적용.
- 유아(infant): 만 2세 미만 요금.
- 필수: (기본가 + 유류세) = 최종가 → total 필드.

## 2. 인원수별 가변 할증 (Group Size Modifiers)
- "4인 출발 시 +250,000", "7인 출발 시 -100,000" 등 → min_pax, extra 매핑.

## 3. 현지 지불 및 객실 추가비
- 가이드/기사 경비: 금액과 화폐($ 또는 원) 정확히 구분 → local_guide_fee (예: "30 USD").
- 싱글차지: single_room_extra (숫자, 원화).

## 4. 날짜 및 좌석 상태
- 날짜: YYYY-MM-DD.
- 상태: '출발확정' | '예약가능' | '대기예약' | '마감'.
- 좌석: "좌석 6석" 등 → seats (숫자).

## 5. 출발일별 항공·미팅 (선택, 모두투어 등 상세에 명시될 때만)
- daily_schedule[] 항목에 carrierName, outboundFlightNo, 공항·시각, inbound*, meeting*Raw 필드를 원문 그대로 넣을 수 있음. 불명확하면 생략.

# Constraint
- "카드사 할인", "쿠폰 적용가" 등 조건부 가격은 무시. 표준 판매가만.
- 유류할증료 0원이면 fuel: 0 으로 표기.
- 가격 정보가 여러 개면 날짜별로 매칭하여 daily_schedule 배열로 나열.

응답은 반드시 아래 JSON만 출력하세요. 다른 설명·마크다운 없이 JSON만 출력합니다.

{
  "product_code": "상품코드",
  "daily_schedule": [
    {
      "date": "YYYY-MM-DD",
      "status": "출발확정 | 예약가능 | 대기예약 | 마감",
      "seats": 6,
      "pricing": {
        "adult": { "base": 1868000, "fuel": 31900, "total": 1899900 },
        "child_nobed": { "base": 1618100, "fuel": 31900, "total": 1650000 },
        "infant": { "base": 186800, "fuel": 0, "total": 186800 }
      },
      "modifiers": [
        { "min_pax": 4, "extra": 250000 },
        { "min_pax": 7, "extra": -100000 }
      ],
      "single_room_extra": 120000,
      "local_guide_fee": "30 USD",
      "carrierName": "아시아나항공",
      "outboundFlightNo": "OZ114",
      "outboundDepartureAirport": "인천",
      "outboundDepartureAt": "2026-04-01T16:05:00",
      "outboundArrivalAirport": "오사카",
      "outboundArrivalAt": "2026-04-01T18:05:00",
      "inboundFlightNo": "OZ113",
      "inboundDepartureAirport": "오사카",
      "inboundDepartureAt": "2026-04-04T19:25:00",
      "inboundArrivalAirport": "인천",
      "inboundArrivalAt": "2026-04-04T21:30:00",
      "meetingInfoRaw": "일정표참조",
      "meetingPointRaw": "인천국제공항 제2터미널 3층 출국장",
      "meetingTerminalRaw": "제2터미널",
      "meetingGuideNoticeRaw": "가이드 별도 연락 예정"
    }
  ]
}

정보 없으면 0·빈 배열. 원문에 있는 숫자만 사용하세요.
` as const

/** B2B 추출: 돈·팩트만, 광고 문구 배제. 불포함/현지지불/쇼핑 최우선 */
export const EXTRACTION_JSON_SCHEMA_B2B = `
응답은 반드시 아래 JSON만 출력하세요. 다른 설명·마크다운 없이 JSON만 출력합니다.

{
  "brand": {
    "detected": "하나투어 | 모두투어 | 노랑풍선 | 참좋은여행 | 기타",
    "productCode": "텍스트 내 상품코드 추출"
  },
  "priceInfo": {
    "adult": 0,
    "child": 0,
    "currency": "KRW"
  },
  "onSiteBudget": {
    "mandatoryGuideFee": {
      "amount": 0,
      "currency": "USD"
    },
    "shoppingCount": 0,
    "shoppingItems": ["쇼핑 품목 리스트"],
    "optionalTours": [
      { "name": "명칭", "price": 0, "currency": "USD", "isWaiting": true }
    ]
  },
  "routeSummary": ["1일차: 핵심동선", "2일차: 핵심동선"],
  "legalDisclaimer": "해당 브랜드의 핵심 규정 요약 (취소수수료 등)",
  "productName": "상품명 (원문에 있으면)",
  "groupNumber": "단체번호 (원문에 있으면)",
  "airline": "항공사 (원문에 있으면)",
  "primaryDestination": "핵심 여행지 하나 (예: 다낭, 방콕)"
}

추출 규칙:
- 쇼핑 횟수: "3회", "3회 예정", "쇼핑센터 방문" 등 문구를 숫자로 변환.
- 선택 관광: 가격이 명시된 것만 배열에 넣고, 대기 시간 포함 여부(isWaiting) 표시.
- 가이드 경비: "불포함" 섹션의 가이드/기사 팁 금액 반드시 추출.
- 브랜드: H, P, A 등 고유 코드·로고 텍스트로 하나투어|모두투어|노랑풍선|참좋은여행|기타 판별.
정보 없으면 0·빈 문자열·빈 배열. 원문에 있는 내용만 넣으세요.
` as const

/** 레거시 스키마 (B2B 매핑용 보조 필드 참고) */
export const EXTRACTION_JSON_SCHEMA = `
응답은 반드시 아래 JSON만 출력하세요. 다른 설명 없이 JSON만 출력합니다.

{
  "brandName": "string (30여 개 여행사 중 상품 코드·말투·고유 명사로 판별한 업체명)",
  "productTitle": "string",
  "productName": "string (productTitle와 동일 또는 상품명)",
  "productCode": "string",
  "groupNumber": "string",
  "airline": "string",
  "primaryDestination": "string (이 상품의 핵심 여행지명 하나만, 예: 다낭, 방콕, 세부. 이미지 URL은 절대 포함하지 마)",
  "priceList": [ { "date": "string", "price": "string", "status": "예약가능|대기|마감 (optional)" } ],
  "factCheck": {
    "shoppingCount": number,
    "shoppingItems": "string (optional)",
    "guideFeeUsd": number (optional, 가이드 경비 달러),
    "optionalTours": [ { "name": "string", "priceUsd": number, "duration": "string (optional)", "waitPlaceIfNotJoined": "string (optional)" } ]
  },
  "itinerary": [ { "day": number, "title": "string", "items": ["string"] } ]
}
정보 없으면 빈 문자열·0·빈 배열 사용. 원문에 있는 내용만 넣으세요.
` as const
