export type PlannedHotel = {
  night: string
  area: string
  grade: string
  note?: string
}

export type OptionalTour = {
  id: string
  name: string
  priceUsd: number
  duration: string
  waitPlaceIfNotJoined: string
}

export type ItineraryDay = {
  day: number
  title: string
  items: string[]
}

export const DISCLAIMER_ITINERARY =
  '현지 교통 및 항공사 사정에 따라 일정 순서가 예고 없이 변경될 수 있음.'
