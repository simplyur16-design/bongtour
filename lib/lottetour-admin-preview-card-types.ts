/**
 * `app/admin/register` 롯데관광 미리보기 카드용 타입 — 전체 등록 SSOT는 `RegisterParsed`·previewPayload 본류.
 */

export type LottetourFlightSegment = {
  departureDateTime: string
  flightNo: string
  arrivalDateTime: string
}

export type LottetourFlightFromBody = {
  airline: string
  outbound: LottetourFlightSegment
  inbound: LottetourFlightSegment
}

export type LottetourOptionalTourFromBody = {
  name: string
  description: string
  priceAdult: number
  priceChild: number
  priceInfant: number
  currency: 'USD' | 'KRW'
  duration: string
  alternativeProgram: string
}

export type LottetourShoppingItemFromBody = {
  itemName: string
  shopLocation: string
  duration: string
  refundable: string
}

export type LottetourScheduleMeals = {
  breakfast: string
  lunch: string
  dinner: string
}

export type LottetourScheduleFinal = {
  dayNumber: number
  title?: string
  activities: string[]
  hotel?: string
  meals: LottetourScheduleMeals
}

export type LottetourMeetingInfo = {
  location: string
  time: string
}

export type LottetourFinalParsed = {
  productCode: string
  title: string
  durationLabel: string
  expectedDayCount: number
  priceAdult: number
  priceChild: number
  priceInfant: number
  fuelSurcharge?: number
  currency: 'KRW'
  flight: LottetourFlightFromBody | null
  schedule: LottetourScheduleFinal[]
  meetingInfo?: LottetourMeetingInfo
  hotelGradeLabel?: string
  includedItems: string[]
  excludedItems: string[]
  optionalTours: LottetourOptionalTourFromBody[]
  shoppingItems: LottetourShoppingItemFromBody[]
  originalBodyText: string
  warnings: string[]
}
