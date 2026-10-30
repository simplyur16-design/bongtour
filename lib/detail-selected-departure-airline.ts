/**
 * 상세 상단(히어로)·하단(핵심정보/예약박스) 항공사 — 같은 선택 출발 회차 facts 하나만 쓴다.
 * 이전: 상단은 Product.airline(상품 대표 항공사), 하단은 선택 회차 facts → 같은 화면에서 대한항공 vs LOT 처럼 어긋남.
 * 선택 회차 항공사를 모를 때만 상품 대표 항공사(비항공사 문구 제거 후)로 대신한다.
 */
import { formatPublicAirlineDisplay } from '@/lib/airline-iata-public-display-ssot'

const NON_AIRLINE_TEXT_RE = /[[\]]|교통|항공권|왕복|편도|불포함|포함|미정|문의|예정|^\s*[-–·•]/

export function sanitizeProductAirlineForDisplay(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim()
  if (!s || NON_AIRLINE_TEXT_RE.test(s)) return null
  return formatPublicAirlineDisplay(s) ?? s
}

export function resolveSelectedDepartureAirlineForDisplay(
  selectedFactsAirline: string | null | undefined,
  productAirline: string | null | undefined,
): string | null {
  const fromRow = String(selectedFactsAirline ?? '').trim()
  if (fromRow) return fromRow
  return sanitizeProductAirlineForDisplay(productAirline)
}

type FactsLike = {
  airline: string | null
  outbound: { flightNo: string | null } | null
  inbound: unknown
  outboundSummary: string | null
  inboundSummary: string | null
  meetingSummary: string | null
}

function airlineKey(raw: string | null | undefined): string {
  const s = formatPublicAirlineDisplay(String(raw ?? '').trim()) ?? String(raw ?? '').trim()
  return s.replace(/\s+/g, '').replace(/항공$/, '').toUpperCase()
}

/**
 * `?airline=` 필터로 고른 항공사와 선택 회차 facts 가 같은 항공사인지 — facts 항공사명, 없으면 가는편 편명 앞 2자리(IATA)로 판단.
 */
export function departureFactsMatchAirline(
  facts: FactsLike | null | undefined,
  filter: { label: string; param: string } | null | undefined,
): boolean {
  if (!facts || !filter) return true
  const want = airlineKey(filter.label)
  if (facts.airline && airlineKey(facts.airline) === want) return true
  const fn = String(facts.outbound?.flightNo ?? '').trim().toUpperCase()
  const iata = fn.match(/^([A-Z]{2}|[A-Z]\d|\d[A-Z])\d{2,4}/)?.[1] ?? null
  if (iata && (iata === filter.param.toUpperCase() || airlineKey(iata) === want)) return true
  return false
}

/**
 * 항공사 필터 선택 중인데 회차 facts 가 다른 항공사(날짜 폴백·근접일 폴백 등)면 — 항공사는 고른 항공사로, 편명·시간(가는편/오는편)은 비운다.
 * 다른 항공사 편명·시각을 고른 항공사 화면에 보여주지 않기 위함(추측 표시 금지). 필터 없으면 그대로.
 */
export function alignDepartureFactsToSelectedAirline<F extends FactsLike>(
  facts: F | null,
  filter: { label: string; param: string } | null | undefined,
): F | null {
  if (!filter) return facts
  if (facts && departureFactsMatchAirline(facts, filter)) {
    return facts.airline ? facts : { ...facts, airline: filter.label }
  }
  return {
    ...(facts ?? ({} as F)),
    airline: filter.label,
    outbound: null,
    inbound: null,
    outboundSummary: null,
    inboundSummary: null,
    meetingSummary: facts?.meetingSummary ?? null,
  } as F
}
