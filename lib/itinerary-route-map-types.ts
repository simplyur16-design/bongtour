/** Product.rawMeta.itineraryRouteMap — 플랫 2D 일정 동선 지도 SSOT */

export const ITINERARY_ROUTE_MAP_RAW_META_KEY = 'itineraryRouteMap' as const
export const ITINERARY_ROUTE_MAP_PROMPT_VERSION = 'v1' as const
export const ITINERARY_ROUTE_MAP_SOURCE = 'gemini_flat_2d' as const

export type ItineraryRouteMapLineStyle = 'dashed_green' | 'solid_blue'

export type ItineraryRouteMapHub = {
  cityKo: string
  cityEn: string
  dayLabel: string
  days: number[]
}

export type ItineraryRouteMapLeg = {
  fromCityKo: string
  toCityKo: string
  icon: string
  durationLabel: string
  lineStyle: ItineraryRouteMapLineStyle
}

export type ItineraryRouteMapMeta = {
  url: string
  source: typeof ITINERARY_ROUTE_MAP_SOURCE
  promptVersion: typeof ITINERARY_ROUTE_MAP_PROMPT_VERSION
  generatedAt: string
  countryKo: string
  countryEn: string
  hubs: ItineraryRouteMapHub[]
  legs: ItineraryRouteMapLeg[]
}

export type ItineraryRouteMapScheduleDay = {
  day: number
  title?: string | null
  description?: string | null
  routeText?: string | null
  city?: string | null
}
