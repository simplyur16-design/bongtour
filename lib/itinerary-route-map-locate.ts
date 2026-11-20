/**
 * 거점 좌표를 붙인다. 내장 도시 캐시 → Nominatim. 실패 지명은 SKIP 하고 남은 구간을 잇는다.
 */

import { lookupCityLonLat, fitHubsToAvailableRegion, loadRouteMapRegionAsset, lonLatInsideBbox } from '@/lib/itinerary-route-map-geo'
import { formatItineraryRouteMapDayLabel } from '@/lib/itinerary-route-map-hubs'
import {
  lookupItineraryPlaceNominatim,
  type NominatimLookupDeps,
} from '@/lib/itinerary-route-map-nominatim'
import type { ItineraryRouteMapHub, ItineraryRouteMapLeg } from '@/lib/itinerary-route-map-types'

export async function locateItineraryRouteMapHubs(
  hubs: ItineraryRouteMapHub[],
  legs: ItineraryRouteMapLeg[],
  deps?: NominatimLookupDeps,
  countryEn?: string,
): Promise<{ hubs: ItineraryRouteMapHub[]; legs: ItineraryRouteMapLeg[]; skipped: string[]; regionId: string }> {
  const skipped: string[] = []
  const staticHubs: ItineraryRouteMapHub[] = []
  const pending: Array<{ index: number; hub: ItineraryRouteMapHub }> = []
  const placed: Array<ItineraryRouteMapHub | null> = hubs.map(() => null)
  for (let i = 0; i < hubs.length; i++) {
    const hub = hubs[i]!
    const cached = lookupCityLonLat(hub.cityEn) ?? lookupCityLonLat(hub.cityKo)
    if (cached) {
      const row = { ...hub, lon: cached.lon, lat: cached.lat }
      placed[i] = row
      staticHubs.push(row)
      continue
    }
    pending.push({ index: i, hub })
  }

  const staticFit = staticHubs.length > 0 ? fitHubsToAvailableRegion(staticHubs, countryEn) : null
  const regionAsset = staticFit ? loadRouteMapRegionAsset(staticFit.regionId) : null
  const bounds = regionAsset ? { bbox: regionAsset.bbox } : undefined

  for (const item of pending) {
    const hub = item.hub
    const query =
      hub.anchorCityKo && hub.anchorCityKo !== hub.cityKo
        ? `${hub.cityKo} ${hub.anchorCityKo}`
        : hub.cityKo
    const point = await lookupItineraryPlaceNominatim(query, deps, bounds)
    if (!point || (bounds && !lonLatInsideBbox(point.lon, point.lat, bounds.bbox))) {
      skipped.push(hub.cityKo)
      continue
    }
    placed[item.index] = { ...hub, lon: point.lon, lat: point.lat }
  }
  const kept = placed.filter((h): h is ItineraryRouteMapHub => h != null)

  const collapsed: ItineraryRouteMapHub[] = []
  for (const hub of kept) {
    const last = collapsed[collapsed.length - 1]
    if (last && last.cityKo === hub.cityKo) {
      last.days = [...last.days, ...hub.days]
      last.dayLabel = formatItineraryRouteMapDayLabel(last.days)
      continue
    }
    collapsed.push({ ...hub, days: [...hub.days] })
  }

  const fitted = fitHubsToAvailableRegion(collapsed, countryEn)
  const keptNames = new Set(fitted.hubs.map((h) => h.cityKo))
  const direct = new Map(legs.map((leg) => [`${leg.fromCityKo}|${leg.toCityKo}`, leg]))
  const nextLegs: ItineraryRouteMapLeg[] = []
  for (let i = 0; i < fitted.hubs.length - 1; i++) {
    const from = fitted.hubs[i]!
    const to = fitted.hubs[i + 1]!
    const exact = direct.get(`${from.cityKo}|${to.cityKo}`)
    if (exact) {
      nextLegs.push(exact)
      continue
    }
    const carried = legs.find((leg) => leg.fromCityKo === from.cityKo && keptNames.has(leg.toCityKo) === false)
    nextLegs.push({
      fromCityKo: from.cityKo,
      toCityKo: to.cityKo,
      icon: carried?.icon ?? '🚗',
      durationLabel: carried?.durationLabel ?? '약 2시간',
      lineStyle: carried?.lineStyle ?? 'dashed_green',
    })
  }
  return { hubs: fitted.hubs, legs: nextLegs, skipped: [...skipped, ...fitted.skipped], regionId: fitted.regionId }
}
