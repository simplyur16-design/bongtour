/**
 * 여정지도 지리 SSOT — 도시 lat/lon, 권역 bbox, path 에셋 로더.
 */

import fs from 'fs'
import path from 'path'
import type { ItineraryRouteMapHub } from '@/lib/itinerary-route-map-types'

export type LonLat = { lon: number; lat: number }

export type RouteMapFeatureLabel = {
  ko: string
  lon: number
  lat: number
  kind?: 'sea' | 'lake' | 'land'
}

/** 도시 권역(오사카/교토 등) — 핀과 별도로 지도에 구역감 표시 */
export type RouteMapAreaLabel = {
  ko: string
  lon: number
  lat: number
  /** 타원 반경(경도·위도 도 단위) */
  rx?: number
  ry?: number
}

export type RouteMapRegionAsset = {
  id: string
  /** [west, south, east, north] */
  bbox: [number, number, number, number]
  landRings: number[][][]
  lakeRings?: number[][][]
  featureLabels?: RouteMapFeatureLabel[]
  areaLabels?: RouteMapAreaLabel[]
  seaLabel?: { ko: string; lon: number; lat: number }
}

export type RouteMapRegionId =
  | 'kansai'
  | 'kanto'
  | 'central-vietnam'
  | 'japan'
  | 'vietnam'
  | 'fallback'

const CITY_LONLAT: Record<string, LonLat> = {
  tokyo: { lon: 139.6917, lat: 35.6895 },
  yokohama: { lon: 139.638, lat: 35.4437 },
  osaka: { lon: 135.5023, lat: 34.6937 },
  kyoto: { lon: 135.7681, lat: 35.0116 },
  nara: { lon: 135.8048, lat: 34.6851 },
  kobe: { lon: 135.1955, lat: 34.6901 },
  nagoya: { lon: 136.9066, lat: 35.1815 },
  fukuoka: { lon: 130.4017, lat: 33.5904 },
  sapporo: { lon: 141.3545, lat: 43.0618 },
  okinawa: { lon: 127.6809, lat: 26.2124 },
  naha: { lon: 127.6809, lat: 26.2124 },
  hiroshima: { lon: 132.4596, lat: 34.3853 },
  hakone: { lon: 139.026, lat: 35.232 },
  'da nang': { lon: 108.2022, lat: 16.0544 },
  'hoi an': { lon: 108.338, lat: 15.8801 },
  hanoi: { lon: 105.8342, lat: 21.0278 },
  'ho chi minh': { lon: 106.6297, lat: 10.8231 },
  'nha trang': { lon: 109.1967, lat: 12.2388 },
  'phu quoc': { lon: 103.984, lat: 10.227 },
  bangkok: { lon: 100.5018, lat: 13.7563 },
  pattaya: { lon: 100.883, lat: 12.9236 },
  'chiang mai': { lon: 98.9853, lat: 18.7883 },
  phuket: { lon: 98.3923, lat: 7.8804 },
  seoul: { lon: 126.978, lat: 37.5665 },
  busan: { lon: 129.0756, lat: 35.1796 },
  jeju: { lon: 126.5312, lat: 33.4996 },
  paris: { lon: 2.3522, lat: 48.8566 },
  rome: { lon: 12.4964, lat: 41.9028 },
  florence: { lon: 11.2558, lat: 43.7696 },
  venice: { lon: 12.3155, lat: 45.4408 },
  milan: { lon: 9.19, lat: 45.4642 },
  barcelona: { lon: 2.1734, lat: 41.3851 },
  madrid: { lon: -3.7038, lat: 40.4168 },
  london: { lon: -0.1276, lat: 51.5074 },
  singapore: { lon: 103.8198, lat: 1.3521 },
  taipei: { lon: 121.5654, lat: 25.033 },
  'hong kong': { lon: 114.1694, lat: 22.3193 },
  guam: { lon: 144.7937, lat: 13.4443 },
}

type RegionRule = {
  id: Exclude<RouteMapRegionId, 'fallback'>
  keys: string[]
}

const REGION_RULES: RegionRule[] = [
  { id: 'kansai', keys: ['osaka', 'kyoto', 'nara', 'kobe'] },
  { id: 'kanto', keys: ['tokyo', 'yokohama', 'hakone'] },
  { id: 'central-vietnam', keys: ['da nang', 'hoi an'] },
]

function keyOf(cityEn: string): string {
  return cityEn.trim().toLowerCase()
}

export function lookupCityLonLat(cityEn: string): LonLat | null {
  const k = keyOf(cityEn)
  if (CITY_LONLAT[k]) return CITY_LONLAT[k]!
  for (const [name, ll] of Object.entries(CITY_LONLAT)) {
    if (k.includes(name) || name.includes(k)) return ll
  }
  return null
}

export function uniqueCityKeys(hubs: ItineraryRouteMapHub[]): string[] {
  const out: string[] = []
  for (const h of hubs) {
    const k = keyOf(h.cityEn)
    if (!out.includes(k)) out.push(k)
  }
  return out
}

export function resolveRouteMapRegionId(
  hubs: ItineraryRouteMapHub[],
  countryEn?: string,
): RouteMapRegionId {
  const keys = uniqueCityKeys(hubs)
  const matched: Array<Exclude<RouteMapRegionId, 'fallback'>> = []
  for (const rule of REGION_RULES) {
    // 거점 전부가 해당 권역 키셋 안에 있을 때만 줌 (나트랑 포함 시 전국 폴백)
    const allIn =
      keys.length >= 2 &&
      keys.every((c) => rule.keys.some((k) => c.includes(k) || k.includes(c)))
    if (allIn) matched.push(rule.id)
  }
  if (matched.length === 1) return matched[0]!

  const country = (countryEn ?? '').toUpperCase()
  if (country.includes('JAPAN') || country === 'JP') return 'japan'
  if (country.includes('VIETNAM') || country === 'VN') return 'vietnam'
  return 'fallback'
}

function dataDir(): string {
  return path.join(process.cwd(), 'data', 'itinerary-route-maps')
}

export function loadRouteMapRegionAsset(regionId: RouteMapRegionId): RouteMapRegionAsset | null {
  if (regionId === 'fallback') return null
  const file = path.join(dataDir(), `${regionId}.json`)
  if (!fs.existsSync(file)) return null
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as RouteMapRegionAsset
    if (!raw?.bbox || !Array.isArray(raw.landRings)) return null
    return { ...raw, id: regionId }
  } catch {
    return null
  }
}

/** 거점 좌표 + 권역 에셋. 미지 도시는 bbox 안 폴백 배치. */
export function resolveHubLonLats(
  hubs: ItineraryRouteMapHub[],
  bbox: [number, number, number, number],
): Array<ItineraryRouteMapHub & LonLat> {
  const [west, south, east, north] = bbox
  const known = hubs.map((h) => lookupCityLonLat(h.cityEn))
  const missing = known.filter((x) => !x).length
  let missIdx = 0
  return hubs.map((h, i) => {
    const ll = known[i]
    if (ll) return { ...h, ...ll }
    const t = missing <= 1 ? 0.5 : missIdx / Math.max(1, missing - 1)
    missIdx++
    return {
      ...h,
      lon: west + (east - west) * (0.35 + t * 0.3),
      lat: south + (north - south) * (0.4 + Math.sin(t * Math.PI) * 0.15),
    }
  })
}

export function padBbox(
  bbox: [number, number, number, number],
  padRatio = 0.08,
): [number, number, number, number] {
  const [w, s, e, n] = bbox
  const dx = (e - w) * padRatio
  const dy = (n - s) * padRatio
  return [w - dx, s - dy, e + dx, n + dy]
}

/** 종횡비 유지 equirectangular (경도는 위도 보정). */
export function projectLonLat(
  lon: number,
  lat: number,
  bbox: [number, number, number, number],
  width: number,
  height: number,
  margin = 56,
): { x: number; y: number } {
  const [w, s, e, n] = bbox
  const midLat = ((s + n) / 2) * (Math.PI / 180)
  const cos = Math.max(0.35, Math.cos(midLat))
  const dataW = Math.max(1e-6, (e - w) * cos)
  const dataH = Math.max(1e-6, n - s)
  const innerW = width - margin * 2
  const innerH = height - margin * 2
  const scale = Math.min(innerW / dataW, innerH / dataH)
  const usedW = dataW * scale
  const usedH = dataH * scale
  const ox = margin + (innerW - usedW) / 2
  const oy = margin + (innerH - usedH) / 2
  const x = ox + (lon - w) * cos * scale
  const y = oy + (n - lat) * scale
  return { x, y }
}
