/**
 * 거점 정규화 좌표(0~1) — lat/lon 투영 기반 (Gemini CITY_XY 폐기).
 */

import type { ItineraryRouteMapHub } from '@/lib/itinerary-route-map-types'
import {
  loadRouteMapRegionAsset,
  padBbox,
  projectLonLat,
  resolveHubLonLats,
  resolveRouteMapRegionId,
} from '@/lib/itinerary-route-map-geo'

export type RouteMapHubPoint = {
  cityKo: string
  cityEn: string
  dayLabel: string
  x: number
  y: number
}

export type RouteMapFrame = 'country' | 'region'

export type RouteMapLayoutResult = {
  points: RouteMapHubPoint[]
  frame: RouteMapFrame
  regionHintEn: string
  span: number
}

export function layoutItineraryRouteMapHubs(
  hubs: ItineraryRouteMapHub[],
  options?: { countryEn?: string },
): RouteMapLayoutResult {
  const regionId = resolveRouteMapRegionId(hubs, options?.countryEn)
  const asset = loadRouteMapRegionAsset(regionId)
  const bbox = padBbox(asset?.bbox ?? [100, 0, 140, 40], 0.06)
  const hubLl = resolveHubLonLats(hubs, bbox)
  const W = 1200
  const H = 900
  const points = hubLl.map((h) => {
    const p = projectLonLat(h.lon, h.lat, bbox, W, H)
    return {
      cityKo: h.cityKo,
      cityEn: h.cityEn,
      dayLabel: h.dayLabel,
      x: p.x / W,
      y: p.y / H,
    }
  })
  let span = 0
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      span = Math.max(
        span,
        Math.hypot(points[j]!.x - points[i]!.x, points[j]!.y - points[i]!.y),
      )
    }
  }
  const frame: RouteMapFrame =
    regionId === 'japan' || regionId === 'vietnam' || regionId === 'fallback'
      ? 'country'
      : 'region'
  return {
    points,
    frame,
    regionHintEn: regionId,
    span,
  }
}
