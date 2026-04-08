/**
 * 관리자 확정 항공여정 — 공급사 자동 파싱(rawMeta structured)과 분리된 SSOT.
 * JSON은 rawMeta.structuredSignals.flightAdminJson 경로를 우선 사용.
 */

import type { DepartureKeyFacts, DepartureLegCard } from '@/lib/departure-key-facts'
import { departureLegHasContent } from '@/lib/departure-key-facts'

/** re-export for consumers that need the same line builder — defined in departure-key-facts as internal; duplicate minimal formatter */
function formatAdminLegSummaryLine(
  direction: 'outbound' | 'inbound',
  leg: DepartureLegCard | null,
  layover: string | null | undefined,
  note: string | null | undefined
): string | null {
  if (!leg && !layover?.trim() && !note?.trim()) return null
  const bits: string[] = []
  const route = leg
    ? [leg.departureAirport, leg.arrivalAirport].filter(Boolean).join(' → ') || null
    : null
  const time = leg?.departureAtText && leg?.arrivalAtText ? `${leg.departureAtText} → ${leg.arrivalAtText}` : leg?.departureAtText || leg?.arrivalAtText || null
  if (route) bits.push(route)
  if (time) bits.push(time)
  if (leg?.flightNo?.trim()) bits.push(leg.flightNo.trim())
  if (layover?.trim()) bits.push(`경유·대기: ${layover.trim()}`)
  if (note?.trim()) bits.push(note.trim())
  if (!bits.length) return null
  return `${direction === 'outbound' ? '가는편' : '오는편'}: ${bits.join(' · ')}`
}

export type AdminFlightProfile = {
  outboundAirlineName?: string | null
  outboundFlightNo?: string | null
  outboundDepartureAirport?: string | null
  outboundDepartureAt?: string | null
  outboundArrivalAirport?: string | null
  outboundArrivalAt?: string | null
  outboundLayoverText?: string | null
  outboundNote?: string | null
  inboundAirlineName?: string | null
  inboundFlightNo?: string | null
  inboundDepartureAirport?: string | null
  inboundDepartureAt?: string | null
  inboundArrivalAirport?: string | null
  inboundArrivalAt?: string | null
  inboundLayoverText?: string | null
  inboundNote?: string | null
  flightSummaryText?: string | null
  flightAdminMemo?: string | null
  isFlightInfoConfirmed?: boolean | null
  flightInfoUpdatedAt?: string | null
  flightInfoUpdatedBy?: string | null
}

export type FlightDisplayPolicy = 'legacy_parsed' | 'admin_only' | 'suppress_no_parsed'

const STR_FIELDS: (keyof AdminFlightProfile)[] = [
  'outboundAirlineName',
  'outboundFlightNo',
  'outboundDepartureAirport',
  'outboundDepartureAt',
  'outboundArrivalAirport',
  'outboundArrivalAt',
  'outboundLayoverText',
  'outboundNote',
  'inboundAirlineName',
  'inboundFlightNo',
  'inboundDepartureAirport',
  'inboundDepartureAt',
  'inboundArrivalAirport',
  'inboundArrivalAt',
  'inboundLayoverText',
  'inboundNote',
  'flightSummaryText',
  'flightAdminMemo',
  'flightInfoUpdatedAt',
  'flightInfoUpdatedBy',
]

function str(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s || null
}

export function parseFlightAdminJson(raw: string | null | undefined): AdminFlightProfile | null {
  if (!raw?.trim()) return null
  try {
    const j = JSON.parse(raw) as Record<string, unknown>
    if (!j || typeof j !== 'object') return null
    const out: AdminFlightProfile = {}
    const outbound = j.outbound && typeof j.outbound === 'object' && !Array.isArray(j.outbound) ? (j.outbound as Record<string, unknown>) : null
    const inbound = j.inbound && typeof j.inbound === 'object' && !Array.isArray(j.inbound) ? (j.inbound as Record<string, unknown>) : null
    if (outbound) {
      out.outboundAirlineName = str(outbound.airlineName)
      out.outboundFlightNo = str(outbound.flightNo)
      out.outboundDepartureAirport = str(outbound.departureAirport)
      out.outboundDepartureAt = str(outbound.departureAt)
      out.outboundArrivalAirport = str(outbound.arrivalAirport)
      out.outboundArrivalAt = str(outbound.arrivalAt)
      out.outboundLayoverText = str(outbound.layoverText)
      out.outboundNote = str(outbound.note)
    }
    if (inbound) {
      out.inboundAirlineName = str(inbound.airlineName)
      out.inboundFlightNo = str(inbound.flightNo)
      out.inboundDepartureAirport = str(inbound.departureAirport)
      out.inboundDepartureAt = str(inbound.departureAt)
      out.inboundArrivalAirport = str(inbound.arrivalAirport)
      out.inboundArrivalAt = str(inbound.arrivalAt)
      out.inboundLayoverText = str(inbound.layoverText)
      out.inboundNote = str(inbound.note)
    }
    out.flightSummaryText = str(j.flightSummaryText) ?? str(j.flightSummary) ?? str(j.note)
    for (const k of STR_FIELDS) {
      const v = str(j[k])
      if (v != null) (out as Record<string, unknown>)[k] = v
    }
    if (typeof j.isFlightInfoConfirmed === 'boolean') out.isFlightInfoConfirmed = j.isFlightInfoConfirmed
    return Object.keys(out).length > 0 ? out : null
  } catch {
    return null
  }
}

export function serializeFlightAdminJson(profile: AdminFlightProfile): string {
  const o: Record<string, unknown> = {}
  for (const k of STR_FIELDS) {
    const v = profile[k]
    if (v != null && String(v).trim()) o[k] = String(v).trim()
  }
  if (profile.isFlightInfoConfirmed != null) o.isFlightInfoConfirmed = profile.isFlightInfoConfirmed
  return JSON.stringify(o)
}

export function hasAdminFlightCoreContent(p: AdminFlightProfile | null | undefined): boolean {
  if (!p) return false
  return Boolean(
    p.outboundAirlineName ||
      p.outboundFlightNo ||
      p.outboundDepartureAirport ||
      p.outboundDepartureAt ||
      p.outboundArrivalAirport ||
      p.outboundArrivalAt ||
      p.inboundAirlineName ||
      p.inboundFlightNo ||
      p.inboundDepartureAirport ||
      p.inboundDepartureAt ||
      p.inboundArrivalAirport ||
      p.inboundArrivalAt ||
      p.flightSummaryText?.trim()
  )
}

/**
 * - 레거기( flightAdminJson 없음 ): 본문 파싱값 병합 허용
 * - 관리자 입력·확정 있으면: 관리자만 SSOT
 * - 미확정 플래그만 있고 항공 필드가 비어 있으면: 본문·출발행 파싱(legacy) 계속 노출 (공개 상세 공백 방지)
 * - 미확정 + 관리자가 일부 필드를 채운 경우는 위에서 admin_only
 */
export function resolveFlightDisplayPolicy(profile: AdminFlightProfile | null): FlightDisplayPolicy {
  if (profile == null) return 'legacy_parsed'
  if (profile.isFlightInfoConfirmed === true || hasAdminFlightCoreContent(profile)) return 'admin_only'
  if (profile.isFlightInfoConfirmed === false && !hasAdminFlightCoreContent(profile)) return 'legacy_parsed'
  return 'legacy_parsed'
}

function buildLegFromAdminFlat(
  airline: string | null | undefined,
  flightNo: string | null | undefined,
  depAp: string | null | undefined,
  depAt: string | null | undefined,
  arrAp: string | null | undefined,
  arrAt: string | null | undefined
): DepartureLegCard | null {
  const departureAirport = depAp?.trim() || null
  const arrivalAirport = arrAp?.trim() || null
  const departureAtText = depAt?.trim() || null
  const arrivalAtText = arrAt?.trim() || null
  const fn = flightNo?.trim() || null
  if (!departureAirport && !arrivalAirport && !departureAtText && !arrivalAtText && !fn) return null
  return {
    departureAirport,
    arrivalAirport,
    departureAtText,
    arrivalAtText,
    flightNo: fn,
  }
}

/** 관리자 프로필만으로 facts 구성(출발일별 meeting 등은 호출부에서 병합) */
export function buildKeyFactsFromAdminProfile(
  profile: AdminFlightProfile,
  productAirline: string | null | undefined
): DepartureKeyFacts {
  const ob = buildLegFromAdminFlat(
    profile.outboundAirlineName,
    profile.outboundFlightNo,
    profile.outboundDepartureAirport,
    profile.outboundDepartureAt,
    profile.outboundArrivalAirport,
    profile.outboundArrivalAt
  )
  const ib = buildLegFromAdminFlat(
    profile.inboundAirlineName,
    profile.inboundFlightNo,
    profile.inboundDepartureAirport,
    profile.inboundDepartureAt,
    profile.inboundArrivalAirport,
    profile.inboundArrivalAt
  )
  const airline =
    profile.outboundAirlineName?.trim() ||
    profile.inboundAirlineName?.trim() ||
    productAirline?.trim() ||
    null

  const outboundSummary = formatAdminLegSummaryLine('outbound', ob, profile.outboundLayoverText, profile.outboundNote)
  const inboundSummary = formatAdminLegSummaryLine('inbound', ib, profile.inboundLayoverText, profile.inboundNote)

  return {
    airline,
    outbound: ob,
    inbound: ib,
    outboundSummary,
    inboundSummary,
    meetingSummary: null,
  }
}

/** YYYY.MM.DD or YYYY-MM-DD in string */
export function extractIsoDatesFromText(s: string | null | undefined): string[] {
  if (!s?.trim()) return []
  const out: string[] = []
  const re = /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) {
    const y = m[1]
    const mo = m[2]!.padStart(2, '0')
    const d = m[3]!.padStart(2, '0')
    out.push(`${y}-${mo}-${d}`)
  }
  return [...new Set(out)]
}

export type AdminFlightDateWarning = {
  kind: 'departure_mismatch' | 'return_mismatch'
  message: string
}

/**
 * 상품 출발일(첫 출발)·귀국일(히어로와 동일하게 보려면 호출부에서 계산)과
 * 관리자 항공 일시 문자열에 포함된 날짜가 어긋나면 경고.
 */
export function computeAdminFlightDateWarnings(
  productDepartureIso: string | null | undefined,
  productReturnIso: string | null | undefined,
  profile: AdminFlightProfile | null
): AdminFlightDateWarning[] {
  if (!profile) return []
  const warnings: AdminFlightDateWarning[] = []
  const outboundDates = [
    ...extractIsoDatesFromText(profile.outboundDepartureAt),
    ...extractIsoDatesFromText(profile.outboundArrivalAt),
  ]
  const inboundDates = [
    ...extractIsoDatesFromText(profile.inboundDepartureAt),
    ...extractIsoDatesFromText(profile.inboundArrivalAt),
  ]
  if (productDepartureIso && outboundDates.length > 0) {
    const dep = productDepartureIso.slice(0, 10)
    if (!outboundDates.some((d) => d === dep)) {
      warnings.push({
        kind: 'departure_mismatch',
        message: `가는편 일시에 기재된 날짜가 상품 출발일(${dep})과 다를 수 있습니다.`,
      })
    }
  }
  if (productReturnIso && inboundDates.length > 0) {
    const ret = productReturnIso.slice(0, 10)
    if (!inboundDates.some((d) => d === ret)) {
      warnings.push({
        kind: 'return_mismatch',
        message: `오는편 일시에 기재된 날짜가 귀국일(${ret})과 다를 수 있습니다.`,
      })
    }
  }
  return warnings
}

export function adminFlightStatusLabel(profile: AdminFlightProfile | null): {
  label: string
  variant: 'ok' | 'warn' | 'muted'
} {
  if (!profile) return { label: '항공여정 미입력', variant: 'muted' }
  if (profile.isFlightInfoConfirmed === true && hasAdminFlightCoreContent(profile)) {
    return { label: '항공여정 확정', variant: 'ok' }
  }
  if (!hasAdminFlightCoreContent(profile) || profile.isFlightInfoConfirmed === false) {
    return { label: '항공여정 미확정', variant: 'warn' }
  }
  return { label: '항공여정 입력됨(미검증)', variant: 'warn' }
}
