/**
 * 출국·귀국 항공 텍스트에서 국내 출발/도착 공항 SSOT.
 * 인천(ICN)은 기본(라벨 없음). 김포·지방·제주는 카드·히어로 표기용.
 * REGRESSION-FREEZE[infer-home-departure-airport]
 * REGRESSION-FREEZE[register-pending-quality-keyword-desc-departure]: [부산]·부산출발 제목 인식 — manifest
 * REGRESSION-FREEZE[register-pending-local-departure-strong-signal]: 내항기 연결·공항세·도착 오탐 금지 — manifest
 */
import type { RegisterFactFlightLeg } from '@/lib/register-facts/types'
import {
  LOCAL_DEPARTURE_TAG_VALUES,
  type LocalDepartureTag,
} from '@/lib/product-listing-kind'

export type HomeDepartureAirportLabel = 'gimpo' | 'busan' | 'cheongju' | 'daegu' | 'jeju'

export const HOME_DEPARTURE_AIRPORT_DISPLAY: Record<HomeDepartureAirportLabel, string> = {
  gimpo: '김포공항',
  busan: '부산공항',
  cheongju: '청주공항',
  daegu: '대구공항',
  jeju: '제주공항',
}

const INCHEON_RE =
  /(?:인천(?:국제)?\s*공항|인천공항|\bICN\b)/iu
const GIMPO_RE = /(?:김포(?:국제)?\s*공항(?!세)|김포공항(?!세)|\bGMP\b|^김포$)/iu

/** 「부산출발 내항기 연결 가능」·「김해공항세」는 지방출발 SKU가 아님 */
const WEAK_REGIONAL_CONNECT_RE =
  /(?:부산|대구|청주|제주|김해|지방)\s*출발\s*(?:내항기|연결)|내항기\s*연결\s*가능|지방\s*출발\s*연결\s*가능/iu

/** 상품이 그 공항에서 출발한다는 강한 신호만 */
const STRONG_BUSAN_RE =
  /(?:\[\s*부산\s*\]|출발확정\s*부산|부산\s*출발(?!\s*(?:내항|연결))|김해\s*출발(?!\s*(?:내항|연결))|부산(?:국제)?\s*공항(?!세)|김해(?:국제)?\s*공항(?!세)|\bPUS\b|^부산$|^김해$)/iu
const STRONG_DAEGU_RE =
  /(?:\[\s*대구\s*\]|출발확정\s*대구|대구\s*출발(?!\s*(?:내항|연결))|대구(?:국제)?\s*공항(?!세)|\bTAE\b|^대구$)/iu
const STRONG_CHEONGJU_RE =
  /(?:\[\s*청주\s*\]|출발확정\s*청주|청주\s*출발(?!\s*(?:내항|연결))|청주(?:국제)?\s*공항(?!세)|\bCJJ\b|^청주$)/iu
/** 제주 목적지 도착(제주공항 도착)은 제외 — 제주출발·[제주]·항공 leg만 */
const STRONG_JEJU_RE =
  /(?:\[\s*제주\s*\]|출발확정\s*제주|제주\s*출발(?!\s*(?:내항|연결))|제주(?:국제)?\s*공항(?!세)\s*출발|\bCJU\b|^제주$)/iu

function stripWeakRegionalConnectMarketing(raw: string): string {
  return String(raw ?? '').replace(WEAK_REGIONAL_CONNECT_RE, ' ')
}

function labelFromHaystack(hay: string): HomeDepartureAirportLabel | null {
  const t = stripWeakRegionalConnectMarketing(hay).trim()
  if (!t) return null
  // 강한 지방출발 표시는 같은 줄에 인천이 있어도 우선 (제목 [부산] + 본문 인천 혼재)
  if (STRONG_BUSAN_RE.test(t)) return 'busan'
  if (STRONG_DAEGU_RE.test(t)) return 'daegu'
  if (STRONG_CHEONGJU_RE.test(t)) return 'cheongju'
  if (STRONG_JEJU_RE.test(t)) return 'jeju'
  if (INCHEON_RE.test(t)) return null
  if (GIMPO_RE.test(t)) return null
  return null
}

/** 항공 leg 한 줄(도시·공항명)에서 국내 공항 라벨 추론 */
export function inferHomeDepartureAirportFromFlightText(
  text: string | null | undefined,
): HomeDepartureAirportLabel | null {
  if (!text?.trim()) return null
  return labelFromHaystack(text)
}

export type InferredDepartureAirportMeta = {
  /** 카드·히어로 표기용 — null이면 인천/기본(라벨 없음) */
  airportLabel: HomeDepartureAirportLabel | null
  /** 메가메뉴 지방출발 탭용 — busan·cheongju·daegu만 */
  localDepartureTags: LocalDepartureTag[]
}

function haystackFromRegisterFactLeg(leg: RegisterFactFlightLeg): string {
  return [leg.departureCity, leg.arrivalCity, leg.flightNo, leg.carrier].filter(Boolean).join(' ')
}

/** register-facts 항공 배열 → 출발 공항·지방출발 태그 */
export function inferDepartureAirportFromRegisterFactFlights(
  flights: RegisterFactFlightLeg[],
): InferredDepartureAirportMeta {
  const outbound = flights.filter((f) => f.direction === 'outbound')
  const inbound = flights.filter((f) => f.direction === 'inbound')
  const tryLegs = [...outbound, ...inbound, ...flights]

  let airportLabel: HomeDepartureAirportLabel | null = null
  for (const leg of tryLegs) {
    const dep = inferHomeDepartureAirportFromFlightText(leg.departureCity)
    if (dep) {
      airportLabel = dep
      break
    }
  }
  if (!airportLabel) {
    for (const leg of inbound) {
      const arr = inferHomeDepartureAirportFromFlightText(leg.arrivalCity)
      if (arr) {
        airportLabel = arr
        break
      }
    }
  }

  return {
    airportLabel,
    localDepartureTags: localDepartureTagsFromAirportLabel(airportLabel),
  }
}

/** 김포·인천(서울권)은 라벨·지방출발 태그 없음. 제주·부산·청주·대구만 지방 태그. */
function localDepartureTagsFromAirportLabel(
  airportLabel: HomeDepartureAirportLabel | null,
): LocalDepartureTag[] {
  if (!airportLabel) return []
  if (airportLabel === 'gimpo') return []
  if (LOCAL_DEPARTURE_TAG_VALUES.includes(airportLabel as LocalDepartureTag)) {
    return [airportLabel as LocalDepartureTag]
  }
  return []
}

/** 본문·항공 요약 텍스트에서 출발 공항 추론 (confirm 시 parsed fallback) */
export function inferDepartureAirportFromHaystack(haystack: string): InferredDepartureAirportMeta {
  const lines = haystack.split(/\r?\n/)
  for (const line of lines) {
    const label = inferHomeDepartureAirportFromFlightText(line)
    if (label) {
      return {
        airportLabel: label,
        localDepartureTags: localDepartureTagsFromAirportLabel(label),
      }
    }
  }
  const label = inferHomeDepartureAirportFromFlightText(haystack)
  return {
    airportLabel: label,
    localDepartureTags: localDepartureTagsFromAirportLabel(label),
  }
}

export function parseHomeDepartureAirportLabel(
  raw: string | null | undefined,
): HomeDepartureAirportLabel | null {
  if (!raw?.trim()) return null
  const t = raw.trim()
  // 김포·인천=서울권 — DB에 legacy 값이 있어도 표기·추론 SSOT는 null
  if (t === 'gimpo') return null
  if (t in HOME_DEPARTURE_AIRPORT_DISPLAY) {
    return t as HomeDepartureAirportLabel
  }
  return null
}

export function homeDepartureAirportDisplayText(
  label: HomeDepartureAirportLabel | string | null | undefined,
): string | null {
  const parsed = typeof label === 'string' ? parseHomeDepartureAirportLabel(label) : label
  if (!parsed) return null
  return HOME_DEPARTURE_AIRPORT_DISPLAY[parsed] ?? null
}
