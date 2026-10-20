/**
 * 동선지도 국토 실루엣 SSOT — 터키 샘플처럼 “한 덩어리 나라 모양”.
 * 다국 일정 = 인접국 외곽을 하나로 이은 실루엣 (섬/초록 blob 금지).
 * Nominatim/타일 금지.
 * REGRESSION-FREEZE[bongtour-route-map-gemini-v1]: resolveBongtourRouteMapLandRings — manifest
 */

export type LonLat = { lng: number; lat: number }

/**
 * 체코·슬로바키아·오스트리아·헝가리 외곽을 시계방향으로 이은 단일 실루엣.
 * 터키 샘플처럼 “한 장 지도”로 읽히게 — 나라별 섬 분리 금지.
 */
const RING_CE_CONTIGUOUS: LonLat[] = [
  // AT west (Vorarlberg) → north along DE border into CZ
  { lng: 9.53, lat: 47.27 },
  { lng: 9.6, lat: 47.55 },
  { lng: 10.2, lat: 47.7 },
  { lng: 11.0, lat: 47.55 },
  { lng: 12.1, lat: 47.7 },
  { lng: 12.2, lat: 48.2 },
  { lng: 12.1, lat: 49.0 },
  { lng: 12.09, lat: 50.1 },
  { lng: 12.4, lat: 50.45 },
  { lng: 13.0, lat: 50.75 },
  { lng: 13.8, lat: 50.85 },
  { lng: 14.5, lat: 50.95 },
  { lng: 15.2, lat: 50.9 },
  { lng: 15.9, lat: 50.7 },
  { lng: 16.5, lat: 50.4 },
  { lng: 17.2, lat: 50.15 },
  { lng: 18.0, lat: 49.9 },
  { lng: 18.5, lat: 49.6 },
  // CZ/PL → SK north
  { lng: 18.7, lat: 49.4 },
  { lng: 19.5, lat: 49.45 },
  { lng: 20.5, lat: 49.4 },
  { lng: 21.5, lat: 49.2 },
  { lng: 22.4, lat: 49.05 },
  { lng: 22.55, lat: 48.7 },
  // SK east → HU NE
  { lng: 22.7, lat: 48.4 },
  { lng: 22.7, lat: 47.9 },
  { lng: 22.5, lat: 47.4 },
  { lng: 22.1, lat: 46.9 },
  { lng: 21.5, lat: 46.4 },
  { lng: 20.8, lat: 46.15 },
  { lng: 20.0, lat: 45.95 },
  { lng: 19.0, lat: 45.85 },
  { lng: 18.0, lat: 45.9 },
  { lng: 17.2, lat: 46.1 },
  { lng: 16.5, lat: 46.4 },
  { lng: 16.15, lat: 46.7 },
  // HU SW → AT south (Karawanken line) west
  { lng: 16.0, lat: 46.85 },
  { lng: 15.5, lat: 46.65 },
  { lng: 14.8, lat: 46.55 },
  { lng: 14.0, lat: 46.55 },
  { lng: 13.2, lat: 46.6 },
  { lng: 12.4, lat: 46.7 },
  { lng: 11.5, lat: 46.75 },
  { lng: 10.6, lat: 46.85 },
  { lng: 9.9, lat: 46.95 },
  { lng: 9.55, lat: 47.15 },
]

/** 터키 — 샘플과 같은 아시아·유럽 돌출 (단일 실루엣) */
const RING_TR: LonLat[] = [
  { lng: 26.05, lat: 39.9 },
  { lng: 26.5, lat: 40.5 },
  { lng: 27.5, lat: 41.35 },
  { lng: 28.5, lat: 41.5 },
  { lng: 29.5, lat: 41.2 },
  { lng: 31.0, lat: 41.6 },
  { lng: 32.8, lat: 42.0 },
  { lng: 34.5, lat: 41.95 },
  { lng: 36.5, lat: 41.5 },
  { lng: 38.5, lat: 41.15 },
  { lng: 40.5, lat: 41.2 },
  { lng: 42.5, lat: 41.15 },
  { lng: 44.2, lat: 40.5 },
  { lng: 44.5, lat: 39.5 },
  { lng: 43.8, lat: 38.5 },
  { lng: 42.5, lat: 37.7 },
  { lng: 40.5, lat: 37.2 },
  { lng: 38.0, lat: 36.9 },
  { lng: 35.5, lat: 36.3 },
  { lng: 33.5, lat: 36.15 },
  { lng: 31.5, lat: 36.3 },
  { lng: 29.5, lat: 36.45 },
  { lng: 28.0, lat: 36.8 },
  { lng: 27.2, lat: 37.5 },
  { lng: 27.0, lat: 38.5 },
  { lng: 26.5, lat: 39.3 },
]

const RING_VN: LonLat[] = [
  { lng: 102.2, lat: 22.5 },
  { lng: 104.5, lat: 22.9 },
  { lng: 106.5, lat: 22.2 },
  { lng: 108.0, lat: 20.5 },
  { lng: 109.0, lat: 17.5 },
  { lng: 109.4, lat: 14.0 },
  { lng: 109.0, lat: 11.0 },
  { lng: 107.0, lat: 8.8 },
  { lng: 105.0, lat: 9.0 },
  { lng: 104.2, lat: 12.0 },
  { lng: 103.5, lat: 16.0 },
  { lng: 102.5, lat: 19.5 },
]

/** 단일국 — 터키 샘플과 동일하게 한 링만 */
const RING_CZ: LonLat[] = [
  { lng: 12.09, lat: 50.33 },
  { lng: 12.4, lat: 50.6 },
  { lng: 13.0, lat: 50.82 },
  { lng: 13.7, lat: 50.9 },
  { lng: 14.4, lat: 50.98 },
  { lng: 15.1, lat: 50.88 },
  { lng: 15.8, lat: 50.6 },
  { lng: 16.4, lat: 50.35 },
  { lng: 17.1, lat: 50.12 },
  { lng: 17.85, lat: 49.82 },
  { lng: 18.55, lat: 49.52 },
  { lng: 18.48, lat: 49.2 },
  { lng: 17.95, lat: 48.95 },
  { lng: 17.35, lat: 48.8 },
  { lng: 16.7, lat: 48.7 },
  { lng: 16.0, lat: 48.68 },
  { lng: 15.3, lat: 48.58 },
  { lng: 14.6, lat: 48.55 },
  { lng: 13.9, lat: 48.62 },
  { lng: 13.2, lat: 48.85 },
  { lng: 12.7, lat: 49.2 },
  { lng: 12.35, lat: 49.55 },
  { lng: 12.15, lat: 49.95 },
]

const RING_AT: LonLat[] = [
  { lng: 9.53, lat: 47.27 },
  { lng: 9.75, lat: 47.55 },
  { lng: 10.4, lat: 47.68 },
  { lng: 11.1, lat: 47.58 },
  { lng: 11.8, lat: 47.52 },
  { lng: 12.5, lat: 47.68 },
  { lng: 13.1, lat: 47.9 },
  { lng: 13.8, lat: 48.15 },
  { lng: 14.5, lat: 48.35 },
  { lng: 15.3, lat: 48.5 },
  { lng: 16.1, lat: 48.58 },
  { lng: 16.95, lat: 48.55 },
  { lng: 17.15, lat: 48.15 },
  { lng: 16.9, lat: 47.75 },
  { lng: 16.55, lat: 47.35 },
  { lng: 16.15, lat: 46.95 },
  { lng: 15.5, lat: 46.7 },
  { lng: 14.7, lat: 46.55 },
  { lng: 13.9, lat: 46.55 },
  { lng: 13.1, lat: 46.62 },
  { lng: 12.3, lat: 46.7 },
  { lng: 11.4, lat: 46.78 },
  { lng: 10.5, lat: 46.85 },
  { lng: 9.8, lat: 46.98 },
  { lng: 9.55, lat: 47.15 },
]

const RING_HU: LonLat[] = [
  { lng: 16.15, lat: 46.85 },
  { lng: 16.7, lat: 47.35 },
  { lng: 17.4, lat: 47.7 },
  { lng: 18.2, lat: 47.95 },
  { lng: 19.0, lat: 48.3 },
  { lng: 19.8, lat: 48.45 },
  { lng: 20.7, lat: 48.4 },
  { lng: 21.5, lat: 48.3 },
  { lng: 22.3, lat: 48.1 },
  { lng: 22.7, lat: 47.75 },
  { lng: 22.55, lat: 47.25 },
  { lng: 22.0, lat: 46.8 },
  { lng: 21.3, lat: 46.4 },
  { lng: 20.5, lat: 46.15 },
  { lng: 19.6, lat: 45.95 },
  { lng: 18.7, lat: 45.85 },
  { lng: 17.7, lat: 45.85 },
  { lng: 16.8, lat: 46.1 },
  { lng: 16.3, lat: 46.45 },
]

/** 레거시·freeze 별칭 — 다국 CE는 통합 외곽과 동일 */
const RING_CENTRAL_EUROPE = RING_CE_CONTIGUOUS

type CountryKey = 'cz' | 'at' | 'hu' | 'tr' | 'vn' | 'ce_contiguous'

const RINGS: Record<CountryKey, LonLat[]> = {
  cz: RING_CZ,
  at: RING_AT,
  hu: RING_HU,
  tr: RING_TR,
  vn: RING_VN,
  ce_contiguous: RING_CENTRAL_EUROPE,
}

const CITY_COUNTRY: Record<string, CountryKey> = {
  부다페스트: 'hu',
  센텐드레: 'hu',
  브르노: 'cz',
  프라하: 'cz',
  체스키부데요비치: 'cz',
  체스키크룸로프: 'cz',
  할슈타트: 'at',
  잘츠부르크: 'at',
  비엔나: 'at',
  빈: 'at',
  멜크: 'at',
  이스탄불: 'tr',
  카파도키아: 'tr',
  안탈리아: 'tr',
  파묵칼레: 'tr',
  다낭: 'vn',
  호이안: 'vn',
  하노이: 'vn',
  호치민: 'vn',
}

function normCity(city: string): string {
  return city.normalize('NFC').replace(/\s+/g, '').trim()
}

/**
 * 방문 도시 → 국토 실루엣 (항상 단일 링 = 터키 샘플 방식).
 * 체오헝 등 다국이면 인접국 통합 외곽 1개.
 */
export function resolveBongtourRouteMapLandRings(cities: string[]): LonLat[][] {
  const keys = new Set<CountryKey>()
  for (const c of cities) {
    const k = CITY_COUNTRY[normCity(c)]
    if (k) keys.add(k)
  }
  if (keys.size === 0) return []

  const ceHits = (['cz', 'at', 'hu'] as const).filter((k) => keys.has(k))
  if (ceHits.length >= 2) {
    return [RING_CENTRAL_EUROPE]
  }

  return [...keys].map((k) => RINGS[k]!).filter((r) => r.length >= 3)
}

export function ringBounds(rings: LonLat[][]): {
  minLng: number
  maxLng: number
  minLat: number
  maxLat: number
} | null {
  let minLng = Infinity
  let maxLng = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity
  let any = false
  for (const ring of rings) {
    for (const p of ring) {
      any = true
      minLng = Math.min(minLng, p.lng)
      maxLng = Math.max(maxLng, p.lng)
      minLat = Math.min(minLat, p.lat)
      maxLat = Math.max(maxLat, p.lat)
    }
  }
  if (!any) return null
  return { minLng, maxLng, minLat, maxLat }
}
