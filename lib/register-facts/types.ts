/**
 * 공급사 등록용 사실 번들 — 원문 일정표 복사 대신 LLM·미리보기에 넘기는 구조화 재료.
 * 저작권: 서술 문장은 LLM이 재작성하고, 여기는 도시·일차·가격·항공 등 사실만 담는다.
 */

export type SupplierRegisterFactSource = 'modetour' | 'hanatour' | 'verygoodtour'

export type RegisterFactScheduleDay = {
  day: number
  places: string[]
  hotels: string[]
  meals: string[]
  transportNote: string | null
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
  /** 디버그·추가 LLM 컨텍스트용 — 원문 HTML 전체는 넣지 않음 */
  notes: string[]
}
