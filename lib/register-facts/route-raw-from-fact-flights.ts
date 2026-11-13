/**
 * 공급사 구조화 항공 구간(fact flights)의 출발·도착 도시를 그대로 이어 routeRaw 원문 근거로 남긴다.
 * 붙여넣기 등으로 이미 routeRaw 가 있으면 덮지 않는다. 추론·번역 없음.
 *
 * REGRESSION-FREEZE[register-route-raw-from-fact-flights]: API 등록 경로 routeRaw null 방지 — manifest
 */
import type { RegisterFactFlightLeg } from '@/lib/register-facts/types'

export function registerRouteRawFromFactFlights(flights: readonly RegisterFactFlightLeg[] | null | undefined): string | null {
  const legs: string[] = []
  const ordered = [...(flights ?? [])].sort(
    (a, b) => (a.direction === 'outbound' ? 0 : 1) - (b.direction === 'outbound' ? 0 : 1),
  )
  for (const f of ordered) {
    const dep = String(f.departureCity ?? '').trim()
    const arr = String(f.arrivalCity ?? '').trim()
    if (!dep || !arr) continue
    const no = String(f.flightNo ?? '').trim()
    legs.push(`${no ? `${no} ` : ''}${dep} → ${arr}`)
  }
  return legs.length ? legs.join(' / ').slice(0, 500) : null
}

export function applyRegisterRouteRawFromFactFlights<T extends { routeRaw?: string | null }>(
  parsed: T,
  flights: readonly RegisterFactFlightLeg[] | null | undefined,
): T {
  if (String(parsed.routeRaw ?? '').trim()) return parsed
  const routeRaw = registerRouteRawFromFactFlights(flights)
  return routeRaw ? { ...parsed, routeRaw } : parsed
}
