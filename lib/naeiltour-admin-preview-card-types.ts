/**
 * `app/admin/register` 내일투어 미리보기 카드용 타입 — 전체 등록 SSOT는 `RegisterParsed`·previewPayload 본류.
 */

export type NaeiltourFlightSegment = {
  departureDateTime: string
  flightNo: string
  arrivalDateTime: string
}

export type NaeiltourFlightFromBody = {
  airline: string
  outbound: NaeiltourFlightSegment
  inbound: NaeiltourFlightSegment
}

export type NaeiltourOptionalTourFromBody = {
  name: string
  description: string
  priceAdult: number
  priceChild: number
  priceInfant: number
  currency: 'USD' | 'KRW'
  duration: string
  alternativeProgram: string
}

export type NaeiltourShoppingItemFromBody = {
  itemName: string
  shopLocation: string
  duration: string
  refundable: string
}

export type NaeiltourScheduleMeals = {
  breakfast: string
  lunch: string
  dinner: string
}

export type NaeiltourScheduleFinal = {
  dayNumber: number
  title?: string
  activities: string[]
  hotel?: string
  meals: NaeiltourScheduleMeals
}

export type NaeiltourMeetingInfo = {
  location: string
  time: string
}

export type NaeiltourFinalParsed = {
  productCode: string
  title: string
  durationLabel: string
  expectedDayCount: number
  priceAdult: number
  priceChild: number
  priceInfant: number
  fuelSurcharge?: number
  currency: 'KRW'
  flight: NaeiltourFlightFromBody | null
  schedule: NaeiltourScheduleFinal[]
  meetingInfo?: NaeiltourMeetingInfo
  hotelGradeLabel?: string
  includedItems: string[]
  excludedItems: string[]
  optionalTours: NaeiltourOptionalTourFromBody[]
  shoppingItems: NaeiltourShoppingItemFromBody[]
  originalBodyText: string
  warnings: string[]
}
