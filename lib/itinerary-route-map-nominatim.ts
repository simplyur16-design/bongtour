/**
 * 일정 지명 좌표 — Nominatim (키 없음).
 * 간격·지터·재시도 1회·실패 SKIP 은 이 모듈만의 상수다.
 */

export type ItineraryPlacePoint = { lon: number; lat: number }

type CacheHit = { lon: number; lat: number; at: number }

const MEMORY = new Map<string, CacheHit | 'miss'>()
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
/** Nominatim 이용 정책: 연속 요청 사이 최소 간격 */
const MIN_GAP_MS = 1100
/** 간격에 더하는 지터 상한(ms) */
const JITTER_MS = 400

let lastRequestAt = 0

export type NominatimLookupDeps = {
  fetchImpl?: typeof fetch
  sleepImpl?: (ms: number) => Promise<void>
  randomImpl?: () => number
  nowImpl?: () => number
}

export type NominatimSearchBounds = {
  bbox: [number, number, number, number]
}

function cacheKey(name: string, bounds?: NominatimSearchBounds): string {
  const base = name.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase()
  if (!bounds) return base
  return `${base}|${bounds.bbox.join(',')}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForTurn(deps: NominatimLookupDeps | undefined): Promise<void> {
  const now = deps?.nowImpl ?? Date.now
  const rand = deps?.randomImpl ?? Math.random
  const pause = deps?.sleepImpl ?? sleep
  const gap = MIN_GAP_MS + Math.floor(rand() * JITTER_MS)
  const wait = gap - (now() - lastRequestAt)
  if (wait > 0) await pause(wait)
  lastRequestAt = now()
}

async function requestOnce(
  name: string,
  deps: NominatimLookupDeps | undefined,
  bounds?: NominatimSearchBounds,
): Promise<ItineraryPlacePoint | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', name)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '1')
  if (bounds) {
    const [west, south, east, north] = bounds.bbox
    url.searchParams.set('viewbox', `${west},${north},${east},${south}`)
    url.searchParams.set('bounded', '1')
  }
  const fetchImpl = deps?.fetchImpl ?? fetch
  const res = await fetchImpl(url.toString(), {
    headers: {
      'User-Agent': 'BongtourItineraryMap/1.0 (https://bongtour.com)',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(12_000),
  })
  if (!res.ok) return null
  const data = (await res.json()) as Array<{ lat?: string; lon?: string }>
  const row = data[0]
  const lat = Number(row?.lat)
  const lon = Number(row?.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  return { lon, lat }
}

/** 메모리 캐시 → 간격+지터 → 실패 시 1회 재시도 → 그래도 실패면 null (SKIP). */
export async function lookupItineraryPlaceNominatim(
  name: string,
  deps?: NominatimLookupDeps,
  bounds?: NominatimSearchBounds,
): Promise<ItineraryPlacePoint | null> {
  const key = cacheKey(name, bounds)
  if (!key) return null
  const cached = MEMORY.get(key)
  const now = deps?.nowImpl ?? Date.now
  if (cached === 'miss') return null
  if (cached && now() - cached.at < CACHE_TTL_MS) {
    return { lon: cached.lon, lat: cached.lat }
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    await waitForTurn(deps)
    try {
      const point = await requestOnce(name.trim(), deps, bounds)
      if (point) {
        MEMORY.set(key, { ...point, at: now() })
        return point
      }
    } catch {
      // 재시도 1회
    }
  }
  MEMORY.set(key, 'miss')
  return null
}

export function resetItineraryPlaceNominatimStateForTests(): void {
  MEMORY.clear()
  lastRequestAt = 0
}
