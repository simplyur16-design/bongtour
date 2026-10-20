/**
 * 하위 호환 — 전체 맵은 render-svg가 SSOT.
 * overlay만 필요하면 빈 베이스 위에 그리지 말고 renderItineraryRouteMapPng 사용.
 */

export { shortCityLabel, renderItineraryRouteMapPng } from '@/lib/itinerary-route-map-render-svg'

import type { ItineraryRouteMapLeg } from '@/lib/itinerary-route-map-types'
import type { RouteMapFrame, RouteMapHubPoint } from '@/lib/itinerary-route-map-layout'
import { renderItineraryRouteMapPng } from '@/lib/itinerary-route-map-render-svg'

/** @deprecated use renderItineraryRouteMapPng */
export async function overlayItineraryRouteMapRoutes(
  _imageBuffer: Buffer,
  points: RouteMapHubPoint[],
  legs: ItineraryRouteMapLeg[],
  _options?: { frame?: RouteMapFrame },
): Promise<Buffer> {
  return renderItineraryRouteMapPng({
    hubs: points.map((p) => ({
      cityKo: p.cityKo,
      cityEn: p.cityEn,
      dayLabel: p.dayLabel,
      days: [],
    })),
    legs,
  })
}
