/**
 * `app/admin/register` 구조화 확인 카드 — 6공급사 공통 미리보기 `data` SSOT.
 */

export type RegisterAdminPreviewOptionalTour = {
  name: string
  description: string
  priceAdult: number
  priceChild: number
  priceInfant: number
  /** ISO 통화코드 — KRW·USD·CAD 등 원문 유지 */
  currency: string
  duration: string
  alternativeProgram: string
}

export type RegisterAdminPreviewShoppingItem = {
  itemName: string
  shopLocation: string
  duration: string
  refundable: string
}

export type RegisterAdminPreviewScheduleMeals = {
  breakfast: string
  lunch: string
  dinner: string
}

export type RegisterAdminPreviewScheduleDay = {
  dayNumber: number
  title?: string
  activities: string[]
  hotel?: string
  meals: RegisterAdminPreviewScheduleMeals
}

export type RegisterAdminPreviewMeetingInfo = {
  location: string
  time: string
}

export type RegisterAdminPreviewFlightSegment = {
  departureDateTime: string
  flightNo: string
  arrivalDateTime: string
}

export type RegisterAdminPreviewFlight = {
  airline: string
  outbound: RegisterAdminPreviewFlightSegment
  inbound: RegisterAdminPreviewFlightSegment
}

export type RegisterAdminFinalParsed = {
  productCode: string
  title: string
  durationLabel: string
  expectedDayCount: number
  priceAdult: number
  priceChild: number
  priceInfant: number
  fuelSurcharge?: number
  currency: 'KRW'
  flight: RegisterAdminPreviewFlight | null
  schedule: RegisterAdminPreviewScheduleDay[]
  meetingInfo?: RegisterAdminPreviewMeetingInfo
  hotelGradeLabel?: string
  includedItems: string[]
  excludedItems: string[]
  optionalTours: RegisterAdminPreviewOptionalTour[]
  shoppingItems: RegisterAdminPreviewShoppingItem[]
  originalBodyText: string
  warnings: string[]
}
