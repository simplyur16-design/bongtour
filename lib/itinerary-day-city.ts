/**
 * ItineraryDay.city — 공급사 구조화 도시 칸에서 온 도시명만 저장한다. 일차 제목·경로 한 줄을 city 로 쓰지 않는다.
 * 도시 칸이 없으면 null (추론 없음).
 *
 * REGRESSION-FREEZE[itinerary-day-city-only]: city 칸에 제목·경로 저장 금지 — manifest
 */
const CITY_MAX = 4
const CITY_LABEL_MAX = 30

function cleanCity(raw: string | null | undefined): string | null {
  const t = String(raw ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t || t.length > CITY_LABEL_MAX) return null
  if (/[.!?。]|입니다|합니다|\d{1,2}:\d{2}/u.test(t)) return null
  return t
}

export function itineraryDayCityFromSupplierCities(cities: readonly (string | null | undefined)[] | null | undefined): string | null {
  const out: string[] = []
  for (const raw of cities ?? []) {
    const c = cleanCity(raw)
    if (!c || out.includes(c)) continue
    out.push(c)
    if (out.length >= CITY_MAX) break
  }
  return out.length ? out.join(' - ') : null
}

export function splitItineraryDayCityText(cityText: string | null | undefined): string[] {
  return String(cityText ?? '')
    .split(/\s*-\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
}
