/**
 * 동선지도 도시 지오코드 — Nominatim (Gemini 좌표 금지).
 * @deprecated 동선지도는 Gemini 그림 경로. Nominatim/무료 타일맵은 비목표.
 */

export type BongtourRouteMapGeoPoint = {
  city: string
  lat: number
  lng: number
  displayName?: string
}

export type BongtourRouteMapGeocodeResult = {
  points: BongtourRouteMapGeoPoint[]
  missing: string[]
  ok: boolean
}

type CacheEntry = { lat: number; lng: number; displayName: string; at: number }

const CACHE = new Map<string, CacheEntry | null>()
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const NOMINATIM_GAP_MS = 1100

let lastFetchAt = 0

function cacheKey(city: string): string {
  return city.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase()
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms))
}

async function nominatimSearch(city: string): Promise<CacheEntry | null> {
  const key = cacheKey(city)
  const hit = CACHE.get(key)
  if (hit !== undefined) {
    if (hit === null) return null
    if (Date.now() - hit.at < CACHE_TTL_MS) return hit
  }

  const wait = NOMINATIM_GAP_MS - (Date.now() - lastFetchAt)
  if (wait > 0) await sleep(wait)

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', city)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')

  lastFetchAt = Date.now()
  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'BongtourRouteMap/1.0 (dev; contact=ops@bongtour.com)',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    CACHE.set(key, null)
    return null
  }
  const data = (await res.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>
  const row = data[0]
  const lat = Number(row?.lat)
  const lng = Number(row?.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    CACHE.set(key, null)
    return null
  }
  const entry: CacheEntry = {
    lat,
    lng,
    displayName: String(row?.display_name || city),
    at: Date.now(),
  }
  CACHE.set(key, entry)
  return entry
}

/** 테스트·스모크용 캐시 주입 */
export function seedBongtourRouteMapGeocodeCache(
  city: string,
  point: { lat: number; lng: number; displayName?: string } | null
): void {
  const key = cacheKey(city)
  if (point == null) {
    CACHE.set(key, null)
    return
  }
  CACHE.set(key, {
    lat: point.lat,
    lng: point.lng,
    displayName: point.displayName || city,
    at: Date.now(),
  })
}

export async function geocodeBongtourRouteMapCities(
  cities: readonly string[]
): Promise<BongtourRouteMapGeocodeResult> {
  const points: BongtourRouteMapGeoPoint[] = []
  const missing: string[] = []
  for (const city of cities) {
    const c = city.trim()
    if (!c) continue
    try {
      const hit = await nominatimSearch(c)
      if (!hit) {
        missing.push(c)
        continue
      }
      points.push({
        city: c,
        lat: hit.lat,
        lng: hit.lng,
        displayName: hit.displayName,
      })
    } catch {
      missing.push(c)
    }
  }
  return {
    points,
    missing,
    ok: points.length >= 2 && missing.length === 0,
  }
}
