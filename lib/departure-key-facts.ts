import type { ProductDeparture } from '@prisma/client'
import {
  extractFlightLegsFromSupplierText,
  extractLegPlacesFromSupplierBlock,
} from '@/lib/flight-leg-heuristics'
import { preferRicherPlaceName } from '@/lib/flight-place-preference'
import type { FlightStructuredBody } from '@/lib/public-product-extras'
import {
  computeFlightDurationMinutesFromLegTexts,
  extractFlightDurationMinutesFromText,
  formatFlightDurationUserLine,
} from '@/lib/flight-duration'
import {
  extractHmFromKoreanDateTimeLine,
  formatKoreanDateTimeLine,
  parseKoreanDateTimeLineToDate,
} from '@/lib/flight-korean-datetime'
import { legHasGarbageFlightFields } from '@/lib/flight-leg-garbage'
import {
  tryModetourDepartureLegCardsFromFlightStructured,
  tryModetourDepartureLegCardsFromStructuredBody,
} from '@/lib/flight-modetour-parser'

/**
 * 출발일별 항공 카드·본문 병합.
 * 모두투어 결정적 leg(`flight-modetour-parser`)는 `FlightStructuredBody.useModetourStructuredFlightLegs===true`일 때만 사용.
 * 플래그는 공개 상세 page에서 modetour일 때만 설정 — 본문만 보고 공급사 추정하지 않음.
 */

/** 편도 카드 — 상세 항공 1덩어리 */
export type DepartureLegCard = {
  departureAirport: string | null
  departureAtText: string | null
  arrivalAirport: string | null
  arrivalAtText: string | null
  flightNo: string | null
  /** 사용자 표시 한 줄, 예: `비행소요시간 2시간 20분` */
  flightDurationText?: string | null
}

export type DepartureKeyFacts = {
  airline: string | null
  outbound: DepartureLegCard | null
  inbound: DepartureLegCard | null
  /** 출발(가는편) 한 줄 요약 */
  outboundSummary: string | null
  /** 도착/귀국(오는편) 한 줄 요약 */
  inboundSummary: string | null
  /** 미팅·집결 안내 */
  meetingSummary: string | null
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토']

function fmtKoreanDateTime(d: Date | null | undefined): string | null {
  if (!d || !(d instanceof Date) || Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const wd = WEEKDAY_KO[d.getDay()]
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}.${m}.${day}(${wd}) ${hh}:${mm}`
}

/** 출발일별 요약 한 줄 — 플레이스홀더(출발/도착/—) 없이 있는 값만 연결 */
function formatLegLine(
  direction: 'outbound' | 'inbound',
  flightNo: string | null,
  depAp: string | null,
  depAt: Date | null,
  arrAp: string | null,
  arrAt: Date | null
): string | null {
  const depA = depAp?.trim() || ''
  const arrA = arrAp?.trim() || ''
  const depT = fmtKoreanDateTime(depAt)
  const arrT = fmtKoreanDateTime(arrAt)
  const fn = flightNo?.trim()
  if (!depA && !arrA && !depT && !arrT && !fn) return null
  const bits: string[] = []
  if (depA && arrA) bits.push(`${depA} → ${arrA}`)
  else if (depA || arrA) bits.push([depA, arrA].filter(Boolean).join(' → '))
  if (depT && arrT) bits.push(`${depT} → ${arrT}`)
  else if (depT || arrT) bits.push([depT, arrT].filter(Boolean).join(' → '))
  if (fn) bits.push(fn)
  if (!bits.length) return null
  return `${direction === 'outbound' ? '가는편' : '오는편'}: ${bits.join(' · ')}`
}

function buildLegDetail(
  flightNo: string | null,
  depAp: string | null,
  depAt: Date | null,
  arrAp: string | null,
  arrAt: Date | null
): DepartureLegCard | null {
  const departureAirport = depAp?.trim() || null
  const arrivalAirport = arrAp?.trim() || null
  const departureAtText = fmtKoreanDateTime(depAt)
  const arrivalAtText = fmtKoreanDateTime(arrAt)
  const flightNoText = flightNo?.trim() || null
  const hasAny = Boolean(departureAirport || arrivalAirport || departureAtText || arrivalAtText || flightNoText)
  if (!hasAny) return null
  return {
    departureAirport,
    departureAtText,
    arrivalAirport,
    arrivalAtText,
    flightNo: flightNoText,
  }
}

export function departureLegHasContent(leg: DepartureLegCard | null | undefined): boolean {
  if (!leg) return false
  return Boolean(
    leg.departureAirport?.trim() ||
      leg.arrivalAirport?.trim() ||
      leg.departureAtText?.trim() ||
      leg.arrivalAtText?.trim() ||
      leg.flightNo?.trim()
  )
}

/** 본문 블록에서 "날짜(요일) 시 → 시" 또는 "날짜 시 → 날짜 시" */
function extractTimeArrowLineFromBlock(block: string): { depAt: string | null; arrAt: string | null } {
  const lines = block.replace(/\r/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean)
  for (const ln of lines) {
    if (!/→|➝/.test(ln) || !/\d{1,2}:\d{2}/.test(ln)) continue
    const m = ln.match(
      /(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}(?:\([^)]*\))?\s+\d{1,2}:\d{2})\s*[→➝>＞]\s*(?:(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}(?:\([^)]*\))?\s+))?(\d{1,2}:\d{2})/
    )
    if (m) {
      const depAt = m[1].replace(/\s+/g, ' ').trim()
      const arrAt = m[2] ? `${m[2].replace(/\s+/g, ' ').trim()} ${m[3]}` : m[3]
      return { depAt, arrAt: arrAt?.trim() ?? null }
    }
  }
  return { depAt: null, arrAt: null }
}

function buildLegFromExtractedBlock(
  segmentBlock: string,
  extraRaw: string,
  ex: {
    departurePlace: string | null
    arrivalPlace: string | null
    flightNos: string[]
    airline: string | null
  },
  explicitFlightNo: string | null
): DepartureLegCard | null {
  const block = [segmentBlock, extraRaw].filter(Boolean).join('\n')
  if (!block.trim()) return null
  const fromBlock = extractLegPlacesFromSupplierBlock(block)
  const depA =
    ex.departurePlace?.trim() || fromBlock.departurePlace?.trim() || null
  const arrA =
    ex.arrivalPlace?.trim() || fromBlock.arrivalPlace?.trim() || null
  const times = extractTimeArrowLineFromBlock(block)
  const fn =
    explicitFlightNo?.trim() || ex.flightNos[0] || fromBlock.flightNos[0] || null
  const hasAny = Boolean(depA || arrA || times.depAt || times.arrAt || fn)
  if (!hasAny) return null
  return {
    departureAirport: depA,
    arrivalAirport: arrA,
    departureAtText: times.depAt,
    arrivalAtText: times.arrAt,
    flightNo: fn,
  }
}

function normAirlineKey(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
}

function mergeLegPreferExisting(
  existing: DepartureLegCard | null,
  fromBody: DepartureLegCard | null,
  opts?: { omitBodyFlightNo?: boolean }
): DepartureLegCard | null {
  const existingUsable =
    existing && legHasGarbageFlightFields(existing) ? null : existing
  if (!fromBody) return existingUsable
  if (!existingUsable) return fromBody
  const omitFn = opts?.omitBodyFlightNo === true
  const flightNoMerged = omitFn
    ? existingUsable.flightNo?.trim() || null
    : existingUsable.flightNo?.trim() || fromBody.flightNo?.trim() || null
  return {
    departureAirport: preferRicherPlaceName(existingUsable.departureAirport, fromBody.departureAirport),
    arrivalAirport: preferRicherPlaceName(existingUsable.arrivalAirport, fromBody.arrivalAirport),
    departureAtText: existingUsable.departureAtText?.trim() || fromBody.departureAtText,
    arrivalAtText: existingUsable.arrivalAtText?.trim() || fromBody.arrivalAtText,
    flightNo: flightNoMerged,
    flightDurationText:
      existingUsable.flightDurationText?.trim() || fromBody.flightDurationText?.trim() || null,
  }
}

/** [모두투어 전용] modLegs 분기에서만 사용 — 결정적 leg가 본문과 일치할 때 기존 행보다 우선 */
function mergeLegPreferDeterministicModetourBody(
  existing: DepartureLegCard | null,
  modBody: DepartureLegCard | null,
  opts?: { omitBodyFlightNo?: boolean }
): DepartureLegCard | null {
  if (!modBody) return mergeLegPreferExisting(existing, null, opts)
  const existingUsable =
    existing && legHasGarbageFlightFields(existing) ? null : existing
  const omitFn = opts?.omitBodyFlightNo === true
  const flightNoMerged = omitFn
    ? existingUsable?.flightNo?.trim() || null
    : modBody.flightNo?.trim() || existingUsable?.flightNo?.trim() || null
  return {
    departureAirport: modBody.departureAirport?.trim() || existingUsable?.departureAirport?.trim() || null,
    arrivalAirport: modBody.arrivalAirport?.trim() || existingUsable?.arrivalAirport?.trim() || null,
    departureAtText: modBody.departureAtText?.trim() || existingUsable?.departureAtText?.trim() || null,
    arrivalAtText: modBody.arrivalAtText?.trim() || existingUsable?.arrivalAtText?.trim() || null,
    flightNo: flightNoMerged,
    flightDurationText:
      existingUsable?.flightDurationText?.trim() || modBody.flightDurationText?.trim() || null,
  }
}

/** 본문 템플릿과 동일 항공사·동일 출발 시각(HH:mm)이면 도착 시각만 보강(편명 복제 없음) */
function enrichLegArrivalFromTemplateLeg(
  leg: DepartureLegCard | null,
  templateLeg: DepartureLegCard | null,
  carrier: string | null,
  templateCarrier: string | null
): DepartureLegCard | null {
  if (!leg || !templateLeg) return leg
  if (!carrier?.trim() || !templateCarrier?.trim()) return leg
  if (normAirlineKey(carrier) !== normAirlineKey(templateCarrier)) return leg
  const hmL = extractHmFromKoreanDateTimeLine(leg.departureAtText)
  const hmT = extractHmFromKoreanDateTimeLine(templateLeg.departureAtText)
  if (!hmL || !hmT || hmL !== hmT) return leg
  if (leg.arrivalAtText?.trim()) return leg
  if (!templateLeg.departureAtText?.trim() || !templateLeg.arrivalAtText?.trim()) return leg

  const dDep = parseKoreanDateTimeLineToDate(leg.departureAtText)
  const tDep = parseKoreanDateTimeLineToDate(templateLeg.departureAtText)
  const tArr = parseKoreanDateTimeLineToDate(templateLeg.arrivalAtText)
  if (!dDep || !tDep || !tArr) return leg
  const diff = tArr.getTime() - tDep.getTime()
  if (diff <= 0) return leg
  const arrOut = new Date(dDep.getTime() + diff)
  const arrText = formatKoreanDateTimeLine(arrOut)
  if (!arrText) return leg
  return {
    ...leg,
    departureAirport: leg.departureAirport?.trim() || templateLeg.departureAirport,
    arrivalAirport: leg.arrivalAirport?.trim() || templateLeg.arrivalAirport,
    arrivalAtText: arrText,
  }
}

function enrichCrossDateFromBodyTemplate(
  facts: DepartureKeyFacts,
  template: DepartureKeyFacts | null
): DepartureKeyFacts {
  if (!template) return facts
  const carrier = facts.airline?.trim() || null
  const tCarrier = template.airline?.trim() || null
  let outbound = enrichLegArrivalFromTemplateLeg(
    facts.outbound,
    template.outbound,
    carrier,
    tCarrier
  )
  let inbound = enrichLegArrivalFromTemplateLeg(facts.inbound, template.inbound, carrier, tCarrier)
  return { ...facts, outbound, inbound }
}

function buildHaystackForOutbound(f: FlightStructuredBody | null | undefined): string {
  if (!f) return ''
  return [f.departureSegmentText, f.departureDateTimeRaw, f.routeRaw].filter((x): x is string => Boolean(x?.trim())).join('\n')
}

function buildHaystackForInbound(f: FlightStructuredBody | null | undefined): string {
  if (!f) return ''
  return [f.returnSegmentText, f.arrivalDateTimeRaw, f.routeRaw].filter((x): x is string => Boolean(x?.trim())).join('\n')
}

function applyDurationToLeg(leg: DepartureLegCard | null, directionHaystack: string): DepartureLegCard | null {
  if (!leg) return null
  let mins = extractFlightDurationMinutesFromText(directionHaystack)
  if (mins == null) mins = computeFlightDurationMinutesFromLegTexts(leg.departureAtText, leg.arrivalAtText)
  const line = mins != null ? formatFlightDurationUserLine(mins) : null
  if (!line) return leg
  return { ...leg, flightDurationText: line }
}

function addFlightDurationsToFacts(facts: DepartureKeyFacts, flight: FlightStructuredBody | null | undefined): DepartureKeyFacts {
  const ob = applyDurationToLeg(facts.outbound, buildHaystackForOutbound(flight))
  const ib = applyDurationToLeg(facts.inbound, buildHaystackForInbound(flight))
  return { ...facts, outbound: ob, inbound: ib }
}

/**
 * 출발일별 맵에 대해 본문 템플릿 병합·동일 패턴 시각 보강·비행소요시간 산출.
 * 출발일이 여러 건이면 본문 편명을 빈 출발행에 일괄 복제하지 않음(omitBodyFlightNo).
 */
export function enrichDepartureKeyFactsMapForDisplay(
  map: Record<string, DepartureKeyFacts>,
  flight: FlightStructuredBody | null | undefined,
  productAirline: string | null | undefined
): Record<string, DepartureKeyFacts> {
  const keys = Object.keys(map).sort()
  const multi = keys.length > 1
  const opts = { omitBodyFlightNo: multi }
  const template = mergeFlightKeyFactsWithStructuredBodyCore(null, flight ?? null, productAirline, opts)
  const out: Record<string, DepartureKeyFacts> = {}
  for (const dateKey of keys) {
    let f = mergeFlightKeyFactsWithStructuredBodyCore(map[dateKey], flight ?? null, productAirline, opts)
    if (!f) f = map[dateKey]
    if (f && template) f = enrichCrossDateFromBodyTemplate(f, template)
    out[dateKey] = addFlightDurationsToFacts(f, flight ?? null)
  }
  return out
}

/** 본문 병합만(비행소요시간은 교차 보강 후 별도 산출) */
function mergeFlightKeyFactsWithStructuredBodyCore(
  facts: DepartureKeyFacts | null,
  flight: FlightStructuredBody | null | undefined,
  productAirline: string | null | undefined,
  options?: { omitBodyFlightNo?: boolean }
): DepartureKeyFacts | null {
  const src = [
    flight?.departureSegmentText,
    flight?.returnSegmentText,
    flight?.routeRaw,
    flight?.departureDateTimeRaw,
    flight?.arrivalDateTimeRaw,
  ].filter((x): x is string => Boolean(x?.trim()))

  const modLegs =
    flight?.useModetourStructuredFlightLegs === true
      ? tryModetourDepartureLegCardsFromStructuredBody(
          flight?.flightRaw ?? null,
          flight?.detailBodyNormalizedRaw ?? null
        ) ?? tryModetourDepartureLegCardsFromFlightStructured(flight?.modetourPersistedFlightStructured ?? null)
      : null

  if (src.length === 0 && !modLegs) return facts

  let fromBodyOutbound: DepartureLegCard | null
  let fromBodyInbound: DepartureLegCard | null
  let extractAirlineOut: string | null = null
  let extractAirlineIn: string | null = null
  if (modLegs) {
    fromBodyOutbound = { ...modLegs.outbound, flightDurationText: null }
    fromBodyInbound = { ...modLegs.inbound, flightDurationText: null }
  } else {
    const { outbound: exOb, inbound: exIb } = extractFlightLegsFromSupplierText(src)
    extractAirlineOut = exOb.airline ?? null
    extractAirlineIn = exIb.airline ?? null
    const obBlock = [flight?.departureSegmentText, flight?.departureDateTimeRaw].filter(Boolean).join('\n')
    const ibBlock = [flight?.returnSegmentText, flight?.arrivalDateTimeRaw].filter(Boolean).join('\n')
    fromBodyOutbound = buildLegFromExtractedBlock(
      obBlock,
      !obBlock.trim() ? src.join('\n') : '',
      exOb,
      flight?.outboundFlightNo ?? null
    )
    fromBodyInbound = buildLegFromExtractedBlock(
      ibBlock,
      !ibBlock.trim() ? src.join('\n') : '',
      exIb,
      flight?.inboundFlightNo ?? null
    )
  }

  const airline =
    facts?.airline?.trim() ||
    flight?.airlineName?.trim() ||
    extractAirlineOut?.trim() ||
    extractAirlineIn?.trim() ||
    productAirline?.trim() ||
    null

  const mergeOpts = { omitBodyFlightNo: options?.omitBodyFlightNo === true }
  const mergeLeg = modLegs ? mergeLegPreferDeterministicModetourBody : mergeLegPreferExisting
  const outbound = mergeLeg(facts?.outbound ?? null, fromBodyOutbound, mergeOpts)
  const inbound = mergeLeg(facts?.inbound ?? null, fromBodyInbound, mergeOpts)

  if (!facts && !departureLegHasContent(outbound) && !departureLegHasContent(inbound) && !airline) return null

  const fnRe = /\b([A-Z]{1,3}\d{2,5})\b/
  const hasFn = (s: string | null | undefined) => Boolean(s && fnRe.test(s))
  let outboundSummary = facts?.outboundSummary ?? null
  let inboundSummary = facts?.inboundSummary ?? null
  let segOb = flight?.departureSegmentText?.trim() ?? null
  if (segOb && /도착\s*[:：]/.test(segOb)) {
    const head = segOb.split(/도착\s*[:：]/)[0]?.trim()
    if (head && head.length >= 12) segOb = head
  }
  const segIb = flight?.returnSegmentText?.trim() ?? null
  if (segOb && hasFn(segOb) && !hasFn(outboundSummary)) outboundSummary = segOb
  if (segIb && hasFn(segIb) && !hasFn(inboundSummary)) inboundSummary = segIb

  return {
    airline,
    outbound,
    inbound,
    outboundSummary,
    inboundSummary,
    meetingSummary: facts?.meetingSummary ?? null,
  }
}

/**
 * ProductDeparture 행에 항공 필드가 비어 있어도, rawMeta structured 본문 구간으로 카드용 facts 보강.
 */
export function mergeFlightKeyFactsWithStructuredBody(
  facts: DepartureKeyFacts | null,
  flight: FlightStructuredBody | null | undefined,
  productAirline: string | null | undefined,
  options?: { omitBodyFlightNo?: boolean }
): DepartureKeyFacts | null {
  const next = mergeFlightKeyFactsWithStructuredBodyCore(facts, flight, productAirline, options)
  if (!next) return facts
  return addFlightDurationsToFacts(next, flight ?? null)
}

function productDepartureToKeyFacts(d: ProductDeparture): DepartureKeyFacts {
  const outbound = formatLegLine(
    'outbound',
    d.outboundFlightNo,
    d.outboundDepartureAirport,
    d.outboundDepartureAt,
    d.outboundArrivalAirport,
    d.outboundArrivalAt
  )
  const inbound = formatLegLine(
    'inbound',
    d.inboundFlightNo,
    d.inboundDepartureAirport,
    d.inboundDepartureAt,
    d.inboundArrivalAirport,
    d.inboundArrivalAt
  )
  return {
    airline: d.carrierName?.trim() || null,
    outbound: buildLegDetail(
      d.outboundFlightNo,
      d.outboundDepartureAirport,
      d.outboundDepartureAt,
      d.outboundArrivalAirport,
      d.outboundArrivalAt
    ),
    inbound: buildLegDetail(
      d.inboundFlightNo,
      d.inboundDepartureAirport,
      d.inboundDepartureAt,
      d.inboundArrivalAirport,
      d.inboundArrivalAt
    ),
    outboundSummary: outbound,
    inboundSummary: inbound,
    /** 미팅은 `meeting-airline-operational-ssot` 상품 단위만 사용 — 출발행 DB/본문 미팅 비노출 */
    meetingSummary: null,
  }
}

export function buildDepartureKeyFactsMap(departures: ProductDeparture[]): Record<string, DepartureKeyFacts> {
  const out: Record<string, DepartureKeyFacts> = {}
  for (const d of departures) {
    const dateStr =
      d.departureDate instanceof Date
        ? d.departureDate.toISOString().slice(0, 10)
        : String(d.departureDate).slice(0, 10)
    out[dateStr] = productDepartureToKeyFacts(d)
  }
  return out
}

/** 동일 캘린더일에 출발 행이 여러 건일 때 — 공개 상세에서 `ProductPriceRow.id`와 1:1 매칭 */
export function buildDepartureKeyFactsByDepartureId(
  departures: ProductDeparture[]
): Record<string, DepartureKeyFacts> {
  const out: Record<string, DepartureKeyFacts> = {}
  for (const d of departures) {
    out[String(d.id)] = productDepartureToKeyFacts(d)
  }
  return out
}

/**
 * 관리자 flightAdminJson(admin_only)과 등록 시 본문·항공 입력에서 나온 parsed facts를 합친다.
 * 관리자가 채운 필드가 우선이고, 비어 있는 leg/시간/공항은 parsed로 보강한다.
 */
function mergeFlightLegAdminWithParsed(
  adminLeg: DepartureLegCard | null | undefined,
  parsedLeg: DepartureLegCard | null | undefined
): DepartureLegCard | null {
  const aOk = adminLeg && departureLegHasContent(adminLeg)
  const pOk = parsedLeg && departureLegHasContent(parsedLeg)
  if (!aOk && !pOk) return null
  if (!aOk) return parsedLeg!
  if (!pOk) return adminLeg!
  const a = adminLeg!
  const p = parsedLeg!
  return {
    departureAirport: a.departureAirport?.trim() || p.departureAirport?.trim() || null,
    arrivalAirport: a.arrivalAirport?.trim() || p.arrivalAirport?.trim() || null,
    departureAtText: a.departureAtText?.trim() || p.departureAtText?.trim() || null,
    arrivalAtText: a.arrivalAtText?.trim() || p.arrivalAtText?.trim() || null,
    flightNo: a.flightNo?.trim() || p.flightNo?.trim() || null,
    flightDurationText: a.flightDurationText?.trim() || p.flightDurationText?.trim() || null,
  }
}

export function mergeAdminDepartureFactsWithParsedLegs(
  admin: DepartureKeyFacts,
  parsed: DepartureKeyFacts | null | undefined
): DepartureKeyFacts {
  if (!parsed) return admin
  return {
    airline: admin.airline?.trim() || parsed.airline?.trim() || null,
    outbound: mergeFlightLegAdminWithParsed(admin.outbound, parsed.outbound),
    inbound: mergeFlightLegAdminWithParsed(admin.inbound, parsed.inbound),
    outboundSummary: admin.outboundSummary?.trim() || parsed.outboundSummary?.trim() || null,
    inboundSummary: admin.inboundSummary?.trim() || parsed.inboundSummary?.trim() || null,
    meetingSummary: null,
  }
}
