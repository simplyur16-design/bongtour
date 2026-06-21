/**
 * 출국·귀국 항공 텍스트에서 국내 출발/도착 공항 SSOT.
 * 인천(ICN)은 기본(라벨 없음). 김포·지방·제주는 카드·히어로 표기용.
 * REGRESSION-FREEZE[infer-home-departure-airport]
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
const GIMPO_RE = /(?:김포(?:국제)?\s*공항|김포공항|\bGMP\b|^김포$)/iu
const BUSAN_RE = /(?:부산(?:국제)?\s*공항|김해(?:국제)?\s*공항|부산공항|김해공항|\bPUS\b|^부산$|^김해$)/iu
const DAEGU_RE = /(?:대구(?:국제)?\s*공항|대구공항|\bTAE\b|^대구$)/iu
const CHEONGJU_RE = /(?:청주(?:국제)?\s*공항|청주공항|\bCJJ\b|^청주$)/iu
const JEJU_RE = /(?:제주(?:국제)?\s*공항|제주공항|\bCJU\b|^제주$)/iu

function labelFromHaystack(hay: string): HomeDepartureAirportLabel | null {
  const t = hay.trim()
  if (!t || INCHEON_RE.test(t)) return null
  if (GIMPO_RE.test(t)) return null
  if (BUSAN_RE.test(t)) return 'busan'
  if (DAEGU_RE.test(t)) return 'daegu'
  if (CHEONGJU_RE.test(t)) return 'cheongju'
  if (JEJU_RE.test(t)) return 'jeju'
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

export function homeDepartureAirportDisplayText(
  label: HomeDepartureAirportLabel | null | undefined,
): string | null {
  if (!label) return null
  return HOME_DEPARTURE_AIRPORT_DISPLAY[label] ?? null
}
