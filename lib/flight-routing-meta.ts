/**
 * 히어로·메타칩용 직항/경유 추론 — 본문 문구 우선, leg/segment 문자열 보조.
 * 사용자 노출 라벨은 직항 | 경유 1회 | 경유 2회 | 경유 있음 만 사용한다.
 */

import { departureLegHasContent, type DepartureKeyFacts, type DepartureLegCard } from '@/lib/departure-key-facts'
import type { FlightStructuredBody } from '@/lib/public-product-extras'

export type FlightRoutingType = 'direct' | 'stopover' | 'multi_stop' | 'unknown'

export type FlightRoutingSource = 'supplier_text' | 'leg_structure' | 'partial_text' | 'default'

export type FlightRoutingMeta = {
  flightRoutingType: FlightRoutingType
  stopCount: number
  /** 사용자 표시 전용 — unknown 금지로 채움 */
  flightRoutingLabel: string
  source: FlightRoutingSource
}

const USER_LABELS = {
  direct: '직항',
  one: '경유 1회',
  two: '경유 2회',
  vague: '경유 있음',
} as const

function labelFromStopCount(n: number): { label: string; type: FlightRoutingType } {
  if (n <= 0) return { label: USER_LABELS.direct, type: 'direct' }
  if (n === 1) return { label: USER_LABELS.one, type: 'stopover' }
  if (n === 2) return { label: USER_LABELS.two, type: 'multi_stop' }
  return { label: USER_LABELS.vague, type: 'multi_stop' }
}

function metaFromStopCount(n: number, source: FlightRoutingSource): FlightRoutingMeta {
  const { label, type } = labelFromStopCount(n)
  return {
    flightRoutingType: type,
    stopCount: Math.max(0, n),
    flightRoutingLabel: label,
    source,
  }
}

/** 화살표 체인에서 공항/도시 꼭짓점 개수로 경유 횟수(중간 기착) 추정 */
export function countIntermediateStopsFromRouteLine(line: string | null | undefined): number | null {
  if (!line?.trim()) return null
  const parts = line
    .replace(/\r/g, '\n')
    .split(/\s*[→➝>＞]\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length < 2) return null

  const placeLike = parts.filter((p) => {
    if (/^\d{1,2}:\d{2}$/.test(p)) return false
    if (/^\d{4}[.\-/년월일]/.test(p)) return false
    if (/^\(\s*[월화수목금토일]\s*\)$/.test(p)) return false
    if (p.length < 2) return false
    return true
  })

  if (placeLike.length < 2) return null
  return Math.max(0, placeLike.length - 2)
}

function maxStopsFromLines(...lines: Array<string | null | undefined>): number | null {
  let best: number | null = null
  for (const ln of lines) {
    const c = countIntermediateStopsFromRouteLine(ln)
    if (c == null) continue
    best = best == null ? c : Math.max(best, c)
  }
  return best
}

function stopsFromStructuredFlight(fs: FlightStructuredBody | null | undefined): number | null {
  if (!fs) return null
  return maxStopsFromLines(
    fs.departureSegmentText,
    fs.returnSegmentText,
    fs.routeRaw,
    fs.departureDateTimeRaw,
    fs.arrivalDateTimeRaw
  )
}

function stopsFromDepartureFacts(f: DepartureKeyFacts | null | undefined): number | null {
  if (!f) return null
  return maxStopsFromLines(f.outboundSummary, f.inboundSummary)
}

/** 구조화 leg 카드는 출발/도착 한 쌍만 있으면 해당 방향 0경유로 본다 */
function legImpliesZeroStops(leg: DepartureLegCard | null | undefined): boolean {
  if (!leg || !departureLegHasContent(leg)) return false
  const a = leg.departureAirport?.trim()
  const b = leg.arrivalAirport?.trim()
  return Boolean(a && b)
}

function stopsFromLegCards(f: DepartureKeyFacts | null | undefined): number | null {
  if (!f) return null
  const ob = legImpliesZeroStops(f.outbound)
  const ib = legImpliesZeroStops(f.inbound)
  if (ob && ib) return 0
  if (ob || ib) return 0
  return null
}

export function buildFlightRoutingHaystack(parts: {
  title?: string | null
  includedText?: string | null
  excludedText?: string | null
  flightStructured?: FlightStructuredBody | null
}): string {
  const fs = parts.flightStructured
  const blobs = [
    parts.title ?? '',
    parts.includedText ?? '',
    parts.excludedText ?? '',
    fs?.airlineName ?? '',
    fs?.departureSegmentText ?? '',
    fs?.returnSegmentText ?? '',
    fs?.routeRaw ?? '',
    fs?.departureDateTimeRaw ?? '',
    fs?.arrivalDateTimeRaw ?? '',
    fs?.outboundFlightNo ?? '',
    fs?.inboundFlightNo ?? '',
  ]
  return blobs.join('\n').replace(/\s+/g, ' ').trim()
}

type TextParseResult =
  | { kind: 'numbered'; n: number }
  | { kind: 'direct' }
  | { kind: 'vague_stop' }
  | null

/**
 * 본문 통합 문자열에서 직항/경유 문구 추출 (우선순위 최상)
 */
export function parseFlightRoutingFromSupplierHaystack(haystack: string): TextParseResult {
  const t = haystack.replace(/\s+/g, ' ')
  if (!t) return null

  let maxN = 0
  const numRes = [
    ...t.matchAll(/(\d+)\s*회\s*경유/gi),
    ...t.matchAll(/경유\s*(\d+)\s*회/gi),
    ...t.matchAll(/(\d+)회\s*경유/gi),
    ...t.matchAll(/(\d+)회경유/gi),
    ...t.matchAll(/(\d+)\s*회\s*당\s*경유/gi),
  ]
  for (const m of numRes) {
    const raw = m[1]
    const n = parseInt(raw, 10)
    if (Number.isFinite(n) && n > 0) maxN = Math.max(maxN, n)
  }
  if (maxN > 0) return { kind: 'numbered', n: maxN }

  const negatesDirect = /비\s*직\s*항|非直航|비직항/u.test(t)

  if (/경유\s*없|무\s*경유|논\s*스탑|논스탑|non-?\s*stop|direct\s*flight/i.test(t)) {
    return { kind: 'direct' }
  }
  if (!negatesDirect && /직\s*항/u.test(t)) {
    return { kind: 'direct' }
  }

  if (
    /경유/u.test(t) ||
    /트랜짓|트랜짓\s*포인트|스탑\s*오버|스톱\s*오버|기착|경유지|경유\s*도시|경유\s*공항/u.test(t)
  ) {
    if (/경유\s*없/u.test(t)) return { kind: 'direct' }
    return { kind: 'vague_stop' }
  }

  return null
}

function pickFirstDepartureFacts(map: Record<string, DepartureKeyFacts> | null | undefined): DepartureKeyFacts | null {
  if (!map || typeof map !== 'object') return null
  const keys = Object.keys(map).sort()
  for (const k of keys) {
    const v = map[k]
    if (v && typeof v === 'object') return v
  }
  return null
}

export type FlightRoutingProductInput = {
  title?: string | null
  includedText?: string | null
  excludedText?: string | null
  flightStructured?: FlightStructuredBody | null
  departureKeyFactsByDate?: Record<string, DepartureKeyFacts> | null
  /** 선택 출발일 기준 facts — 있으면 leg 보조에 우선 사용 */
  departureFactsOverride?: DepartureKeyFacts | null
}

/**
 * 상품 단위 직항/경유 메타 — 메타칩·항공 카드 보조용
 */
export function inferFlightRoutingMeta(input: FlightRoutingProductInput): FlightRoutingMeta {
  const haystack = buildFlightRoutingHaystack({
    title: input.title,
    includedText: input.includedText,
    excludedText: input.excludedText,
    flightStructured: input.flightStructured ?? null,
  })

  const text = parseFlightRoutingFromSupplierHaystack(haystack)
  if (text?.kind === 'numbered') {
    return metaFromStopCount(text.n, 'supplier_text')
  }
  if (text?.kind === 'direct') {
    return metaFromStopCount(0, 'supplier_text')
  }
  if (text?.kind === 'vague_stop') {
    return {
      flightRoutingType: 'stopover',
      stopCount: -1,
      flightRoutingLabel: USER_LABELS.vague,
      source: 'partial_text',
    }
  }

  const firstFacts =
    input.departureFactsOverride ??
    pickFirstDepartureFacts(input.departureKeyFactsByDate ?? null)

  const fromStruct = stopsFromStructuredFlight(input.flightStructured ?? null)
  const fromFactsLine = stopsFromDepartureFacts(firstFacts)
  const fromLegs = stopsFromLegCards(firstFacts)

  const legCandidates = [fromStruct, fromFactsLine, fromLegs].filter((x): x is number => x != null)
  const legMax = legCandidates.length ? Math.max(...legCandidates) : null

  if (legMax != null) {
    return metaFromStopCount(legMax, 'leg_structure')
  }

  return {
    flightRoutingType: 'unknown',
    stopCount: -1,
    flightRoutingLabel: USER_LABELS.direct,
    source: 'default',
  }
}

export function productHasFlightMetaContext(
  input: FlightRoutingProductInput & { airline?: string | null }
): boolean {
  if (input.airline?.trim()) return true
  const airline = input.flightStructured?.airlineName?.trim()
  if (airline) return true
  if (input.flightStructured && Object.values(input.flightStructured).some((v) => typeof v === 'string' && v.trim()))
    return true
  const f = input.departureFactsOverride ?? pickFirstDepartureFacts(input.departureKeyFactsByDate ?? null)
  if (!f) return false
  return Boolean(
    departureLegHasContent(f.outbound) ||
      departureLegHasContent(f.inbound) ||
      f.outboundSummary?.trim() ||
      f.inboundSummary?.trim()
  )
}
