import type { FlightStructured } from '@/lib/detail-body-parser'
import type { DepartureKeyFacts, DepartureLegCard } from '@/lib/departure-key-facts'

export type ReviewState = 'auto' | 'needs_review' | 'manually_edited' | 'approved'

/** structuredSignals.flightManualCorrection.{outbound|inbound}.final|auto — 필드 단위 SSOT */
export type FlightLegManualOverride = {
  airline?: string | null
  departureAirport?: string | null
  departureDate?: string | null
  departureTime?: string | null
  arrivalAirport?: string | null
  arrivalDate?: string | null
  arrivalTime?: string | null
  flightNo?: string | null
}

export type FlightManualLegPayload = {
  auto?: FlightLegManualOverride | null
  final?: FlightLegManualOverride | null
  reviewState?: ReviewState
  rawSnippet?: string | null
}

export type FlightManualCorrectionPayload = {
  outbound?: FlightManualLegPayload
  inbound?: FlightManualLegPayload
}

function parseRawMetaObject(rawMeta: string | null | undefined): Record<string, unknown> {
  if (!rawMeta?.trim()) return {}
  try {
    const parsed = JSON.parse(rawMeta) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    return {}
  } catch {
    return {}
  }
}

function trimOrNull(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s || null
}

/** structuredSignals.flightManualCorrection (optional) */
export function getFlightManualCorrectionFromRawMeta(rawMeta: string | null | undefined): FlightManualCorrectionPayload | null {
  const meta = parseRawMetaObject(rawMeta)
  const s = meta.structuredSignals
  if (!s || typeof s !== 'object' || Array.isArray(s)) return null
  const c = (s as Record<string, unknown>).flightManualCorrection
  if (!c || typeof c !== 'object' || Array.isArray(c)) return null
  return normalizeFlightManualCorrectionPayload(c as Record<string, unknown>)
}

export function normalizeFlightManualCorrectionPayload(input: Record<string, unknown>): FlightManualCorrectionPayload | null {
  const out: FlightManualCorrectionPayload = {}
  const leg = (k: 'outbound' | 'inbound') => {
    const raw = input[k]
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return
    const r = raw as Record<string, unknown>
    const auto = normalizeLegOverride(r.auto)
    const fin = normalizeLegOverride(r.final)
    const reviewState = r.reviewState
    const rs: ReviewState | undefined =
      reviewState === 'auto' ||
      reviewState === 'needs_review' ||
      reviewState === 'manually_edited' ||
      reviewState === 'approved'
        ? reviewState
        : undefined
    const rawSnippet = trimOrNull(r.rawSnippet)
    if (!auto && !fin && !rs && !rawSnippet) return
    out[k] = {
      ...(auto ? { auto } : {}),
      ...(fin ? { final: fin } : {}),
      ...(rs ? { reviewState: rs } : {}),
      ...(rawSnippet ? { rawSnippet } : {}),
    }
  }
  leg('outbound')
  leg('inbound')
  return Object.keys(out).length > 0 ? out : null
}

function normalizeLegOverride(v: unknown): FlightLegManualOverride | null {
  if (v == null) return null
  if (typeof v !== 'object' || Array.isArray(v)) return null
  const o = v as Record<string, unknown>
  const airline = trimOrNull(o.airline)
  const departureAirport = trimOrNull(o.departureAirport)
  const departureDate = trimOrNull(o.departureDate)
  const departureTime = trimOrNull(o.departureTime)
  const arrivalAirport = trimOrNull(o.arrivalAirport)
  const arrivalDate = trimOrNull(o.arrivalDate)
  const arrivalTime = trimOrNull(o.arrivalTime)
  const flightNo = trimOrNull(o.flightNo)
  if (
    !airline &&
    !departureAirport &&
    !departureDate &&
    !departureTime &&
    !arrivalAirport &&
    !arrivalDate &&
    !arrivalTime &&
    !flightNo
  )
    return null
  return {
    airline,
    departureAirport,
    departureDate,
    departureTime,
    arrivalAirport,
    arrivalDate,
    arrivalTime,
    flightNo,
  }
}

/** 자동 추출 항공 structured에서 편명/시간만 */
export function extractFlightLegAutoFromFlightStructured(
  fs: FlightStructured | null | undefined
): { outbound: FlightLegManualOverride; inbound: FlightLegManualOverride } {
  const out = fs?.outbound
  const inn = fs?.inbound
  const carrier = fs?.airlineName?.trim() || null
  return {
    outbound: {
      airline: carrier,
      departureAirport: out?.departureAirport ?? null,
      departureDate: out?.departureDate ?? null,
      departureTime: out?.departureTime ?? null,
      arrivalAirport: out?.arrivalAirport ?? null,
      arrivalDate: out?.arrivalDate ?? null,
      arrivalTime: out?.arrivalTime ?? null,
      flightNo: out?.flightNo ?? null,
    },
    inbound: {
      airline: carrier,
      departureAirport: inn?.departureAirport ?? null,
      departureDate: inn?.departureDate ?? null,
      departureTime: inn?.departureTime ?? null,
      arrivalAirport: inn?.arrivalAirport ?? null,
      arrivalDate: inn?.arrivalDate ?? null,
      arrivalTime: inn?.arrivalTime ?? null,
      flightNo: inn?.flightNo ?? null,
    },
  }
}

/** flat structuredSignals 필드 보조 (nested 없을 때 편명) */
export function mergeFlatFlightNoIntoAuto(
  auto: { outbound: FlightLegManualOverride; inbound: FlightLegManualOverride },
  flat: { outboundFlightNo?: string | null; inboundFlightNo?: string | null }
): { outbound: FlightLegManualOverride; inbound: FlightLegManualOverride } {
  return {
    outbound: {
      ...auto.outbound,
      flightNo: auto.outbound.flightNo?.trim() ? auto.outbound.flightNo : trimOrNull(flat.outboundFlightNo),
    },
    inbound: {
      ...auto.inbound,
      flightNo: auto.inbound.flightNo?.trim() ? auto.inbound.flightNo : trimOrNull(flat.inboundFlightNo),
    },
  }
}

export function effectiveFlightLegField(
  finalLeg: FlightLegManualOverride | null | undefined,
  autoLeg: FlightLegManualOverride,
  field: keyof FlightLegManualOverride
): string | null {
  const f = finalLeg?.[field]
  if (f != null && String(f).trim()) return String(f).trim()
  const a = autoLeg[field]
  if (a != null && String(a).trim()) return String(a).trim()
  return null
}

/** 기존 한국어 일시 줄에서 HH:mm만 교체; 없으면 hm 단독 반환 */
export function mergeHmIntoDisplayLine(existing: string | null | undefined, hm: string | null | undefined): string | null {
  if (!hm?.trim()) return existing?.trim() || null
  const t = hm.trim()
  if (!existing?.trim()) return t
  const m = existing.match(
    /^(\d{4}\.\d{2}\.\d{2}\([^)]*\)\s+)(\d{1,2}:\d{2})(.*)$/
  )
  if (m) return `${m[1]}${t}${m[3] ?? ''}`
  const replaced = existing.replace(/\b(\d{1,2}:\d{2})\b(?=[^\d→]*$)/, t)
  if (replaced !== existing) return replaced
  return `${existing} ${t}`
}

function joinManualDateTime(
  dateStr: string | null | undefined,
  timeStr: string | null | undefined
): string | null {
  const d = trimOrNull(dateStr)
  const t = trimOrNull(timeStr)
  if (d && t) return `${d} ${t}`.replace(/\s+/g, ' ').trim()
  return d || t || null
}

/** final에 값이 하나라도 있으면 true (표시는 raw/auto와 섞지 않고 final만 조합) */
export function manualFinalLegHasAny(final: FlightLegManualOverride | null | undefined): boolean {
  if (!final) return false
  return Boolean(
    trimOrNull(final.airline) ||
      trimOrNull(final.departureAirport) ||
      trimOrNull(final.departureDate) ||
      trimOrNull(final.departureTime) ||
      trimOrNull(final.arrivalAirport) ||
      trimOrNull(final.arrivalDate) ||
      trimOrNull(final.arrivalTime) ||
      trimOrNull(final.flightNo)
  )
}

export function flightManualCorrectionHasActiveFinal(
  correction: FlightManualCorrectionPayload | null | undefined
): boolean {
  if (!correction) return false
  return (
    manualFinalLegHasAny(correction.outbound?.final) ||
    manualFinalLegHasAny(correction.inbound?.final) ||
    manualFinalLegHasAny(correction.outbound?.auto) ||
    manualFinalLegHasAny(correction.inbound?.auto)
  )
}

function pickLegForManualDisplay(leg: FlightManualLegPayload | undefined): FlightLegManualOverride | null {
  if (!leg) return null
  if (manualFinalLegHasAny(leg.final)) return leg.final!
  if (manualFinalLegHasAny(leg.auto)) return leg.auto!
  return null
}

/** final 필드만으로 DepartureLegCard 구성 (비어 있으면 null — 항공사만 있는 경우 등) */
export function buildDepartureLegCardFromManualFinal(final: FlightLegManualOverride): DepartureLegCard | null {
  const departureAirport = trimOrNull(final.departureAirport)
  const arrivalAirport = trimOrNull(final.arrivalAirport)
  const departureAtText = joinManualDateTime(final.departureDate, final.departureTime)
  const arrivalAtText = joinManualDateTime(final.arrivalDate, final.arrivalTime)
  const flightNo = trimOrNull(final.flightNo)
  const hasLegBits = Boolean(
    departureAirport || arrivalAirport || departureAtText || arrivalAtText || flightNo
  )
  if (!hasLegBits) return null
  return {
    departureAirport,
    arrivalAirport,
    departureAtText,
    arrivalAtText,
    flightNo,
  }
}

/**
 * mergeFlightKeyFactsWithStructuredBody 이후 — outbound/inbound final에 값이 있으면
 * 해당 다리는 **final 필드만**으로 카드를 만들고 raw/auto 병합 결과는 쓰지 않음.
 */
export function applyFlightManualCorrectionToDepartureKeyFacts(
  facts: DepartureKeyFacts | null,
  correction: FlightManualCorrectionPayload | null | undefined
): DepartureKeyFacts | null {
  if (!facts || !correction) return facts
  let { airline, outbound, inbound } = facts
  const obDisplay = pickLegForManualDisplay(correction.outbound)
  const ibDisplay = pickLegForManualDisplay(correction.inbound)

  if (obDisplay) {
    outbound = buildDepartureLegCardFromManualFinal(obDisplay) ?? null
  }
  if (ibDisplay) {
    inbound = buildDepartureLegCardFromManualFinal(ibDisplay) ?? null
  }

  const obAir = trimOrNull(obDisplay?.airline)
  const ibAir = trimOrNull(ibDisplay?.airline)
  if (obAir && ibAir && obAir !== ibAir) {
    airline = `${obAir} / ${ibAir}`
  } else if (obAir || ibAir) {
    airline = obAir ?? ibAir ?? airline
  }

  return {
    ...facts,
    airline: airline ?? facts.airline,
    outbound,
    inbound,
  }
}

function legOverrideHasAny(leg: FlightLegManualOverride | undefined): boolean {
  if (!leg) return false
  return manualFinalLegHasAny(leg)
}

/** 재파싱 후: auto 갱신, final·reviewState·rawSnippet 유지 */
export function mergeFlightManualCorrectionOnReparse(
  prev: FlightManualCorrectionPayload | null | undefined,
  nextAuto: { outbound: FlightLegManualOverride; inbound: FlightLegManualOverride }
): FlightManualCorrectionPayload | undefined {
  const out: FlightManualCorrectionPayload = {}
  for (const side of ['outbound', 'inbound'] as const) {
    const p = prev?.[side]
    const na = nextAuto[side]
    const block: FlightManualLegPayload = {
      auto: na,
      final: p?.final ?? null,
      ...(p?.reviewState ? { reviewState: p.reviewState } : {}),
      ...(p?.rawSnippet ? { rawSnippet: p.rawSnippet } : {}),
    }
    const keep =
      legOverrideHasAny(na) ||
      legOverrideHasAny(p?.final ?? undefined) ||
      p?.reviewState ||
      (p?.rawSnippet && p.rawSnippet.trim())
    if (keep) out[side] = block
  }
  return Object.keys(out).length > 0 ? out : undefined
}
