/**
 * `app/admin/register` 교보이지 미리보기 카드용 타입 — 전체 등록 SSOT는 `RegisterParsed`·previewPayload 본류.
 */

export type KyowontourFlightSegment = {
  departureDateTime: string
  flightNo: string
  arrivalDateTime: string
}

export type KyowontourFlightFromBody = {
  airline: string
  outbound: KyowontourFlightSegment
  inbound: KyowontourFlightSegment
}

export type KyowontourOptionalTourFromBody = {
  name: string
  description: string
  priceAdult: number
  priceChild: number
  priceInfant: number
  currency: 'USD' | 'KRW'
  duration: string
  alternativeProgram: string
}

export type KyowontourShoppingItemFromBody = {
  itemName: string
  shopLocation: string
  duration: string
  refundable: string
}

export type KyowontourScheduleMeals = {
  breakfast: string
  lunch: string
  dinner: string
}

export type KyowontourScheduleFinal = {
  dayNumber: number
  title?: string
  activities: string[]
  hotel?: string
  meals: KyowontourScheduleMeals
}

export type KyowontourMeetingInfo = {
  location: string
  time: string
}

export type KyowontourFinalParsed = {
  productCode: string
  title: string
  durationLabel: string
  expectedDayCount: number
  priceAdult: number
  priceChild: number
  priceInfant: number
  fuelSurcharge?: number
  currency: 'KRW'
  flight: KyowontourFlightFromBody | null
  schedule: KyowontourScheduleFinal[]
  meetingInfo?: KyowontourMeetingInfo
  hotelGradeLabel?: string
  includedItems: string[]
  excludedItems: string[]
  optionalTours: KyowontourOptionalTourFromBody[]
  shoppingItems: KyowontourShoppingItemFromBody[]
  originalBodyText: string
  warnings: string[]
}
