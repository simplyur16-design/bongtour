/**
 * 상품 상세 항공정보 — 사용자 화면 전용(부분확인형). 내부 검수 문구는 여기서 걸러낸다.
 */

import { legHasGarbageFlightFields } from '@/lib/flight-leg-garbage'

const BANNED_USER_SUBSTRINGS =
  /추출\s*필요|확인중|미입력|출발지\s*확인중|도착지\s*확인중|도착시간\s*미입력|출발시간\s*미입력|편명\s*상담\s*시\s*확인\s*가능|항공\s*예정|예정\s*항공|항공일정\s*미정|편명\s*미정|항공\s*미정/i

/** preview/검수용 요약이 사용자에게 넘어올 때 내부 톤 제거 */
export function sanitizeFlightFallbackForUser(s: string | null | undefined): string | null {
  if (!s?.trim()) return null
  const t = s.replace(/\s+/g, ' ').trim()
  if (BANNED_USER_SUBSTRINGS.test(t)) return null
  return t
}

/** 1행: 출발공항명 → 도착공항명 (한쪽만 있어도 표시) */
export function formatFlightRouteLine(dep: string | null | undefined, arr: string | null | undefined): string | null {
  const d = dep?.replace(/\s+/g, ' ').trim()
  const a = arr?.replace(/\s+/g, ' ').trim()
  if (d && a) return `${d} → ${a}`
  if (d) return d
  if (a) return a
  return null
}

/**
 * 2행: 날짜/시간 — 부분확인형
 * - 둘 다 있으면 `출발 → 도착`
 * - 도착만 없으면 출발 시각만 `HH:mm 출발` (본문에 시각이 있을 때)
 */
/**
 * 가는편/오는편 카드 — 한 줄 흐름 (공항·날짜·시각이 쪼개지지 않게).
 * 예: 인천 2026.07.07(화) 19:20 → 연길 2026.07.07(화) 20:40
 */
export function formatFlightLegFlowLine(
  depAirport: string | null | undefined,
  arrAirport: string | null | undefined,
  departureAtText: string | null | undefined,
  arrivalAtText: string | null | undefined
): string | null {
  const da = depAirport?.replace(/\s+/g, ' ').trim() || ''
  const aa = arrAirport?.replace(/\s+/g, ' ').trim() || ''
  const dt = departureAtText?.replace(/\s+/g, ' ').trim() || ''
  const at = arrivalAtText?.replace(/\s+/g, ' ').trim() || ''
  if (dt && at && da && aa) return `${da} ${dt} → ${aa} ${at}`
  if (da && aa && (dt || at)) {
    const left = dt ? `${da} ${dt}` : da
    const right = at ? `${aa} ${at}` : aa
    return `${left} → ${right}`
  }
  if (da && aa) return `${da} → ${aa}`
  const timeOnly = formatFlightTimeLinePartial(dt || null, at || null)
  if (timeOnly && (da || aa)) {
    const parts = [da || null, timeOnly, aa || null].filter(Boolean) as string[]
    return parts.join(' ')
  }
  return formatFlightRouteLine(da, aa) || timeOnly
}

export function formatFlightTimeLinePartial(
  departureAtText: string | null | undefined,
  arrivalAtText: string | null | undefined
): string | null {
  const d = departureAtText?.replace(/\s+/g, ' ').trim()
  const a = arrivalAtText?.replace(/\s+/g, ' ').trim()
  if (!d && !a) return null
  if (d && a) return `${d} → ${a}`
  if (d && !a) {
    const m = d.match(/(\d{1,2}:\d{2})/)
    if (m) return `${m[1]} 출발`
    return `${d} 출발`
  }
  if (!d && a) {
    const m = a.match(/(\d{1,2}:\d{2})/)
    if (m) return `${m[1]} 도착`
    return `${a} 도착`
  }
  return null
}

/** 3행: 항공사 / 편명 — 편명 없을 때는 별도 힌트 줄과 짝 */
export function formatFlightMetaLine(
  carrier: string | null | undefined,
  flightNo: string | null | undefined
): { main: string | null; showFlightFinalConfirmHint: boolean } {
  const c = carrier?.replace(/\s+/g, ' ').trim() || ''
  const f = flightNo?.replace(/\s+/g, ' ').trim() || ''
  if (c && f) return { main: `${c} / ${f}`, showFlightFinalConfirmHint: false }
  if (c && !f) return { main: c, showFlightFinalConfirmHint: true }
  if (!c && f) return { main: f, showFlightFinalConfirmHint: false }
  return { main: null, showFlightFinalConfirmHint: false }
}

export const FLIGHT_FINAL_CONFIRM_HINT = '편명은 상담 시 최종 확인됩니다.'

/** 공개 상세용 — 숫자 토막 공항·연도만 있는 시각 등 깨진 leg는 표시하지 않음 */
export function publicDepartureLegCardIsPresentable(leg: {
  departureAirport?: string | null
  arrivalAirport?: string | null
  departureAtText?: string | null
  arrivalAtText?: string | null
  flightNo?: string | null
} | null | undefined): boolean {
  if (!leg) return false
  if (legHasGarbageFlightFields(leg)) return false
  const flow = formatFlightLegFlowLine(
    leg.departureAirport,
    leg.arrivalAirport,
    leg.departureAtText,
    leg.arrivalAtText
  )
  const fn = leg.flightNo?.replace(/\s+/g, ' ').trim()
  return Boolean((flow && flow.trim()) || fn)
}

/** 항공여정 행 — `가는편: 인천 … → 연길 … / CZ6074` (편명은 본문에 없을 때만 힌트 줄 사용) */
export function formatDirectedFlightRow(
  directionLabel: '가는편' | '오는편',
  leg: {
    departureAirport?: string | null
    arrivalAirport?: string | null
    departureAtText?: string | null
    arrivalAtText?: string | null
    flightNo?: string | null
    /** 예: `총 13시간 15분 소요` — 하나투어 정형 항공칸 등 */
    durationText?: string | null
  } | null | undefined
): { line: string | null; showFlightHint: boolean } {
  if (!leg) return { line: null, showFlightHint: false }
  if (legHasGarbageFlightFields(leg)) return { line: null, showFlightHint: false }
  const flow = formatFlightLegFlowLine(
    leg.departureAirport,
    leg.arrivalAirport,
    leg.departureAtText,
    leg.arrivalAtText
  )
  const fn = leg.flightNo?.replace(/\s+/g, ' ').trim() || ''
  const { showFlightFinalConfirmHint } = formatFlightMetaLine(null, fn || null)
  if (!flow && !fn) return { line: null, showFlightHint: false }
  let body = flow || ''
  if (fn && body && !body.includes(fn)) body = `${body} / ${fn}`.trim()
  else if (!body && fn) body = fn
  const dur = leg.durationText?.replace(/\s+/g, ' ').trim()
  if (dur && body && !body.includes(dur)) body = `${body} · ${dur}`.trim()
  else if (dur && !body) body = dur
  return {
    line: body ? `${directionLabel}: ${body}` : null,
    showFlightHint: showFlightFinalConfirmHint && !fn,
  }
}
