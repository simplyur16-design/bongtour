/**
 * REGRESSION-FREEZE[rep-departure-future-1031]: 대표 항공·편명·일정 스냅샷은 "오늘 이후 가장 가까운 판매 중 출발"이어야 한다.
 *
 * 원인(2026-10-31): 등록 시점의 seed 출발(evCd)로 수집한 rawMeta.structuredSignals(flightStructured·
 * flightManualCorrection.auto·flightRaw·일정 본문)가 상품 단위 "대표"로 굳어, 그 출발이 지나고 항공사가 바뀐
 * 회차(예: pkg-yb-0034 260902EK00 EK323/EK322 → 현 판매 TK91/TK90)에도 그대로 덮어씌워졌다.
 *
 * - 표시: 스냅샷이 해당 출발 회차의 것이 아니고(날짜 다름) 항공사/편명 계열도 다르면 그 회차에는 스냅샷
 *   항공사·편명·시간을 적용하지 않는다(회차 자체 값만, 추정 금지). 오늘 날짜와 무관한 결정이라 payload
 *   재빌드 없이도 출발이 지나 다음 회차로 넘어갈 때 자동으로 맞다.
 * - 재수집: 스냅샷 출발일이 오늘 이전이면 오늘 이후 가장 가까운 판매 중 출발을 재수집 대상으로 계획한다.
 * 공급사 원문·DB 값은 건드리지 않는다(표시·계획 전용).
 */
import { isDepartureOnSaleForImport } from '@/lib/departure-booking-status'

export type RepresentativeFlightSnapshot = {
  /** 스냅샷(대표 일정)이 수집된 출발일 YYYY-MM-DD — 모르면 null */
  ymd: string | null
  ymdSource: 'fmc.auto' | 'flightStructured' | 'departureDateTimeRaw' | 'originCode' | null
  airline: string | null
  outboundFlightNo: string | null
  inboundFlightNo: string | null
  /** 관리자 수동 확정(final) 존재 — 의도된 값이므로 회차 불일치여도 유지 */
  hasManualFinal: boolean
}

type Obj = Record<string, unknown>
const asObj = (v: unknown): Obj | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null)
const str = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s ? s : null
}

export function ymdFromLooseDate(v: unknown): string | null {
  const m = String(v ?? '').match(/(20\d\d)[-./](\d{1,2})[-./](\d{1,2})/)
  if (!m) return null
  return `${m[1]}-${m[2]!.padStart(2, '0')}-${m[3]!.padStart(2, '0')}`
}

/** 노랑풍선 evCd 형태(goods-YYMMDDCC00)의 출발일 */
export function ymdFromEvCdShapedOriginCode(code: string | null | undefined): string | null {
  const m = String(code ?? '').trim().match(/^[A-Z]{2,4}\d{3,5}-(\d{2})(\d{2})(\d{2})[A-Z0-9]{2}\d{2}$/)
  if (!m) return null
  return `20${m[1]}-${m[2]}-${m[3]}`
}

function legHasAny(leg: Obj | null): boolean {
  if (!leg) return false
  return Object.values(leg).some((v) => typeof v === 'string' && v.trim().length > 0)
}

export function resolveRepresentativeFlightSnapshot(args: {
  structuredSignals?: unknown
  flightManualCorrection?: unknown
  originCode?: string | null
}): RepresentativeFlightSnapshot {
  const ss = asObj(args.structuredSignals) ?? {}
  const fs = asObj(ss.flightStructured) ?? {}
  const fmc = asObj(args.flightManualCorrection) ?? asObj(ss.flightManualCorrection) ?? {}
  const ob = asObj(fmc.outbound) ?? {}
  const ib = asObj(fmc.inbound) ?? {}
  const obAuto = asObj(ob.auto)
  const ibAuto = asObj(ib.auto)
  const hasManualFinal = legHasAny(asObj(ob.final)) || legHasAny(asObj(ib.final))
  const fsOb = asObj(fs.outbound) ?? {}
  const fsIb = asObj(fs.inbound) ?? {}

  let ymd: string | null = null
  let ymdSource: RepresentativeFlightSnapshot['ymdSource'] = null
  const cands: Array<[unknown, NonNullable<RepresentativeFlightSnapshot['ymdSource']>]> = [
    [obAuto?.departureDate, 'fmc.auto'],
    [fsOb.departureDate, 'flightStructured'],
    [ss.departureDateTimeRaw, 'departureDateTimeRaw'],
  ]
  for (const [v, src] of cands) {
    const y = ymdFromLooseDate(v)
    if (y) {
      ymd = y
      ymdSource = src
      break
    }
  }
  if (!ymd) {
    const y = ymdFromEvCdShapedOriginCode(args.originCode)
    if (y) {
      ymd = y
      ymdSource = 'originCode'
    }
  }
  return {
    ymd,
    ymdSource,
    airline: str(obAuto?.airline) ?? str(fs.airlineName) ?? str(ss.airlineName) ?? null,
    outboundFlightNo: str(obAuto?.flightNo) ?? str(fsOb.flightNo) ?? str(ss.outboundFlightNo) ?? null,
    inboundFlightNo: str(ibAuto?.flightNo) ?? str(fsIb.flightNo) ?? str(ss.inboundFlightNo) ?? null,
    hasManualFinal,
  }
}

/** 항공사 표기 동등 비교 — 공백·괄호 주석 제거, 티웨이→트리니티 상호 변경만 동일 취급 */
export function normalizeCarrierLabelForCompare(v: string | null | undefined): string {
  return String(v ?? '')
    // '트리니티항공(구)티웨이항공' 같은 "(구)이전명" 접미는 통째로 제거
    .replace(/\(\s*구\s*\).*$/, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\s+/g, '')
    .replace(/주식회사|㈜/g, '')
    .replace(/^티웨이항공$/, '트리니티항공')
    .trim()
}

export function carrierLabelsEquivalent(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = normalizeCarrierLabelForCompare(a)
  const y = normalizeCarrierLabelForCompare(b)
  return Boolean(x) && x === y
}

export function iataPrefixOfFlightNo(v: string | null | undefined): string | null {
  const m = String(v ?? '').trim().toUpperCase().match(/^([A-Z0-9]{2})\s?\d{1,4}[A-Z]?$/)
  return m ? m[1]! : null
}

/**
 * 스냅샷 항공(항공사·편명·시간)을 이 출발 회차에 덮어써도 되는가.
 * 판단 불가(스냅샷 날짜·항공사 모름, 회차 항공사 모름)는 기존 동작 유지(true).
 */
export function snapshotAppliesToDeparture(
  snapshot: RepresentativeFlightSnapshot,
  dep: { ymd: string | null; carrierName?: string | null; outboundFlightNo?: string | null },
): boolean {
  if (snapshot.hasManualFinal) return true
  if (!snapshot.ymd || !dep.ymd) return true
  if (snapshot.ymd === dep.ymd) return true
  const depPrefix = iataPrefixOfFlightNo(dep.outboundFlightNo)
  const snapPrefix = iataPrefixOfFlightNo(snapshot.outboundFlightNo)
  if (depPrefix && snapPrefix) return depPrefix === snapPrefix
  const depCarrier = str(dep.carrierName)
  if (!depCarrier || !snapshot.airline) return true
  return carrierLabelsEquivalent(snapshot.airline, depCarrier)
}

export type RepresentativeRecollectDeparture = {
  ymd: string
  code?: string | null
  statusRaw?: string | null
  isBookable?: boolean | null
}

/** 오늘(KST) 이후 가장 가까운 판매 중 출발 — 마감(수집 규칙과 동일)·isBookable=false 제외 */
export function pickNearestOnSaleDepartureOnOrAfter<T extends RepresentativeRecollectDeparture>(
  departures: readonly T[],
  todayYmd: string,
): T | null {
  let best: T | null = null
  for (const d of departures) {
    if (!d?.ymd || d.ymd < todayYmd) continue
    if (d.isBookable === false) continue
    if (!isDepartureOnSaleForImport(d.statusRaw)) continue
    if (!best || d.ymd < best.ymd) best = d
  }
  return best
}

export type RepresentativeRecollectPlan = {
  needed: boolean
  reason: 'snapshot_past' | 'snapshot_current' | 'snapshot_unknown' | 'no_future_on_sale'
  snapshotYmd: string | null
  target: RepresentativeRecollectDeparture | null
}

/** 재수집 훅: 스냅샷 출발일이 지났으면 오늘 이후 가장 가까운 판매 중 출발을 대상으로 계획 */
export function planRepresentativeRecollect(args: {
  snapshot: RepresentativeFlightSnapshot
  departures: readonly RepresentativeRecollectDeparture[]
  todayYmd: string
}): RepresentativeRecollectPlan {
  const target = pickNearestOnSaleDepartureOnOrAfter(args.departures, args.todayYmd)
  const snapshotYmd = args.snapshot.ymd
  if (!snapshotYmd) return { needed: false, reason: 'snapshot_unknown', snapshotYmd, target }
  if (snapshotYmd >= args.todayYmd) return { needed: false, reason: 'snapshot_current', snapshotYmd, target }
  if (!target) return { needed: false, reason: 'no_future_on_sale', snapshotYmd, target: null }
  return { needed: true, reason: 'snapshot_past', snapshotYmd, target }
}

export function kstTodayYmdForRepresentative(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10)
}
