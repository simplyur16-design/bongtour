/**
 * 동선지도용 도시 좌표 SSOT (정적) — Nominatim/OSM 타일 금지.
 * REGRESSION-FREEZE[bongtour-route-map-gemini-v1]: resolveBongtourRouteMapCityCoord — manifest
 */

export type BongtourRouteMapCityCoord = { lat: number; lng: number }

/** 한국어 표기 → WGS84 (대표 좌표) */
const CITY_COORDS: Record<string, BongtourRouteMapCityCoord> = {
  부다페스트: { lat: 47.4979, lng: 19.0402 },
  브르노: { lat: 49.1951, lng: 16.6068 },
  프라하: { lat: 50.0755, lng: 14.4378 },
  체스키부데요비치: { lat: 48.9745, lng: 14.4743 },
  체스케부데요비체: { lat: 48.9745, lng: 14.4743 },
  체스키크룸로프: { lat: 48.8127, lng: 14.3175 },
  할슈타트: { lat: 47.5622, lng: 13.6493 },
  잘츠부르크: { lat: 47.8095, lng: 13.055 },
  비엔나: { lat: 48.2082, lng: 16.3738 },
  빈: { lat: 48.2082, lng: 16.3738 },
  뮌헨: { lat: 48.1351, lng: 11.582 },
  베를린: { lat: 52.52, lng: 13.405 },
  파리: { lat: 48.8566, lng: 2.3522 },
  로마: { lat: 41.9028, lng: 12.4964 },
  피렌체: { lat: 43.7696, lng: 11.2558 },
  베니스: { lat: 45.4408, lng: 12.3155 },
  베네치아: { lat: 45.4408, lng: 12.3155 },
  다낭: { lat: 16.0544, lng: 108.2022 },
  호이안: { lat: 15.8801, lng: 108.338 },
  하노이: { lat: 21.0278, lng: 105.8342 },
  호치민: { lat: 10.8231, lng: 106.6297 },
  방콕: { lat: 13.7563, lng: 100.5018 },
  치앙마이: { lat: 18.7883, lng: 98.9853 },
  도쿄: { lat: 35.6762, lng: 139.6503 },
  오사카: { lat: 34.6937, lng: 135.5023 },
  교토: { lat: 35.0116, lng: 135.7681 },
  후쿠오카: { lat: 33.5904, lng: 130.4017 },
  삿포로: { lat: 43.0618, lng: 141.3545 },
  이스탄불: { lat: 41.0082, lng: 28.9784 },
  카파도키아: { lat: 38.6431, lng: 34.8289 },
  바르셀로나: { lat: 41.3874, lng: 2.1686 },
  마드리드: { lat: 40.4168, lng: -3.7038 },
  리스본: { lat: 38.7223, lng: -9.1393 },
  암스테르담: { lat: 52.3676, lng: 4.9041 },
  취리히: { lat: 47.3769, lng: 8.5417 },
  인터라켄: { lat: 46.6863, lng: 7.8632 },
  센텐드레: { lat: 47.6794, lng: 19.0669 },
  멜크: { lat: 48.2273, lng: 15.331 },
  크라쿠프: { lat: 50.0647, lng: 19.945 },
  바르샤바: { lat: 52.2297, lng: 21.0122 },
  부다페스트야경: { lat: 47.4979, lng: 19.0402 },
}

const ALIAS: Record<string, string> = {
  체스케부데요비치: '체스키부데요비치',
  vienna: '비엔나',
  prague: '프라하',
  budapest: '부다페스트',
  salzburg: '잘츠부르크',
  hallstatt: '할슈타트',
  brno: '브르노',
}

function normCity(city: string): string {
  return city.normalize('NFC').replace(/\s+/g, '').trim()
}

export function resolveBongtourRouteMapCityCoord(city: string): BongtourRouteMapCityCoord | null {
  const k = normCity(city)
  if (!k) return null
  if (CITY_COORDS[k]) return CITY_COORDS[k]!
  const alias = ALIAS[k] || ALIAS[k.toLowerCase()]
  if (alias && CITY_COORDS[alias]) return CITY_COORDS[alias]!
  // partial contains
  for (const [name, coord] of Object.entries(CITY_COORDS)) {
    if (k.includes(name) || name.includes(k)) return coord
  }
  return null
}
