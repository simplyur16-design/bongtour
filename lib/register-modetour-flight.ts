/**
 * 모두투어 등록 전용: flightRaw 확장 + directed raw 줄 + 결정적 structured 보강.
 */
import type { DetailBodyParseSnapshot } from '@/lib/detail-body-parser'
import type { RegisterParsed } from '@/lib/register-llm-schema-modetour'
import {
  buildModetourDirectedSegmentLinesFromFlightRaw,
  extractModetourAirlineMatch,
} from '@/lib/flight-modetour-parser'
import { formatDirectedFlightRow } from '@/lib/flight-user-display'
import type { DepartureInput } from '@/lib/upsert-product-departures-modetour'

function combineFlightDateTime(d: string | null | undefined, t: string | null | undefined): string | null {
  const dd = (d ?? '').replace(/-/g, '.').trim()
  const tt = (t ?? '').trim()
  if (dd && tt) return `${dd} ${tt}`
  return dd || tt || null
}

/** 모두투어 결정적 structured 항공만으로 가는/오는 편 한 줄 생성 */
export function resolveDirectedFlightLinesDeterministicOnly(detailBody: DetailBodyParseSnapshot): {
  departureSegmentFromStructured: string | null
  returnSegmentFromStructured: string | null
} {
  const modetourDeterministicOk =
    detailBody.flightStructured.debug?.modetourParseTrace?.deterministicParserSucceeded === true
  const obLeg = detailBody.flightStructured.outbound
  const ibLeg = detailBody.flightStructured.inbound

  if (!modetourDeterministicOk) {
    return { departureSegmentFromStructured: null, returnSegmentFromStructured: null }
  }

  return {
    departureSegmentFromStructured: formatDirectedFlightRow('가는편', {
      departureAirport: obLeg.departureAirport,
      arrivalAirport: obLeg.arrivalAirport,
      departureAtText: combineFlightDateTime(obLeg.departureDate, obLeg.departureTime),
      arrivalAtText: combineFlightDateTime(obLeg.arrivalDate, obLeg.arrivalTime),
      flightNo: obLeg.flightNo,
    }).line,
    returnSegmentFromStructured: formatDirectedFlightRow('오는편', {
      departureAirport: ibLeg.departureAirport,
      arrivalAirport: ibLeg.arrivalAirport,
      departureAtText: combineFlightDateTime(ibLeg.departureDate, ibLeg.departureTime),
      arrivalAtText: combineFlightDateTime(ibLeg.arrivalDate, ibLeg.arrivalTime),
      flightNo: ibLeg.flightNo,
    }).line,
  }
}

function modetourLegDateTimeSlot(
  date: string | null | undefined,
  time: string | null | undefined
): string | null {
  const d = String(date ?? '').trim().replace(/\./g, '-')
  const t = String(time ?? '').trim()
  if (d && t) return `${d} ${t}`
  return d || t || null
}

/**
 * 달력 행(Gemini)에 항공 슬롯이 비어 있어도, 본문 `flightStructured`가 있으면 출발별 미리보기·히어로·DB upsert에 동일 항공이 실리게 한다.
 */
function modetourFlightLegHasFillableSignals(leg: {
  departureAirport?: string | null
  arrivalAirport?: string | null
  departureDate?: string | null
  departureTime?: string | null
  arrivalDate?: string | null
  arrivalTime?: string | null
  flightNo?: string | null
} | null | undefined): boolean {
  if (!leg) return false
  return Boolean(
    leg.flightNo?.trim() ||
      leg.departureAirport?.trim() ||
      leg.arrivalAirport?.trim() ||
      leg.departureDate?.trim() ||
      leg.departureTime?.trim() ||
      leg.arrivalDate?.trim() ||
      leg.arrivalTime?.trim()
  )
}

export let lastModetourAirlineDebug: {
  extractedAirlineRaw: string | null
  normalizedAirline: string | null
  usedFallbackAirline: boolean
} | null = null

function modetourAirlinePlaceholder(s: string | null | undefined): boolean {
  const t = (s ?? '').trim()
  if (!t) return true
  return /^항공예정$/i.test(t) || /^항공\s*미정/i.test(t) || t === 'TBD'
}

/**
 * 본문 flightStructured·느슨 추출·parsed 항공 필드를 합쳐 `항공예정` 오탐을 줄인다.
 */
export function mergeModetourAirlineFieldsIntoParsed(parsed: RegisterParsed): RegisterParsed {
  lastModetourAirlineDebug = null
  const db = parsed.detailBodyStructured
  const fs = db?.flightStructured
  const sectionHay = [
    db?.raw?.flightRaw,
    (db?.sections ?? [])
      .filter((s) => /항공|편명|출발|공항|flight|airline/i.test(s.text ?? ''))
      .map((s) => s.text)
      .join('\n'),
    db?.normalizedRaw,
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 24000)

  const looseHit = extractModetourAirlineMatch(sectionHay)
  const fsAir = fs?.airlineName?.trim() || null
  const fromParsed = parsed.airlineName?.trim() || parsed.airline?.trim() || null

  const pick = (a: string | null | undefined) => (a && !modetourAirlinePlaceholder(a) ? a.trim() : null)
  const best = pick(fsAir) ?? pick(looseHit?.normalized) ?? pick(fromParsed) ?? null
  const usedFallbackAirline = best == null

  lastModetourAirlineDebug = {
    extractedAirlineRaw: looseHit?.raw ?? null,
    normalizedAirline: best,
    usedFallbackAirline,
  }

  let detailBodyStructured = db
  if (db && fs && best && (modetourAirlinePlaceholder(fs.airlineName) || !fs.airlineName?.trim())) {
    detailBodyStructured = {
      ...db,
      flightStructured: {
        ...fs,
        airlineName: best,
      },
    }
  }

  const pbName = parsed.airlineName?.trim() || null
  const pbAir = parsed.airline?.trim() || null
  const fromParsedOk =
    (pbName && !modetourAirlinePlaceholder(pbName) ? pbName : null) ??
    (pbAir && !modetourAirlinePlaceholder(pbAir) ? pbAir : null) ??
    null
  const chosen = best ?? fromParsedOk

  return {
    ...parsed,
    ...(detailBodyStructured ? { detailBodyStructured } : {}),
    airlineName: chosen,
    airline: chosen,
  }
}

export function enrichModetourDepartureInputsFromFlightStructured(
  inputs: DepartureInput[],
  parsed: RegisterParsed
): DepartureInput[] {
  const fs = parsed.detailBodyStructured?.flightStructured
  if (!fs || inputs.length === 0) return inputs
  const ob = fs.outbound
  const ib = fs.inbound
  const useOb = modetourFlightLegHasFillableSignals(ob)
  const useIb = modetourFlightLegHasFillableSignals(ib)
  const carrier =
    fs.airlineName?.trim() || parsed.airlineName?.trim() || parsed.airline?.trim() || null
  if (!useOb && !useIb) {
    if (!carrier?.trim() || modetourAirlinePlaceholder(carrier)) return inputs
    return inputs.map((d) => {
      const next: DepartureInput = { ...d }
      if (!next.carrierName?.trim()) next.carrierName = carrier
      return next
    })
  }
  return inputs.map((d) => {
    const next: DepartureInput = { ...d }
    if (carrier && !next.carrierName?.trim() && !modetourAirlinePlaceholder(carrier))
      next.carrierName = carrier
    if (useOb && ob) {
      if (!next.outboundFlightNo?.trim() && ob.flightNo?.trim()) next.outboundFlightNo = ob.flightNo
      if (!next.outboundDepartureAirport?.trim() && ob.departureAirport?.trim())
        next.outboundDepartureAirport = ob.departureAirport
      if (!next.outboundArrivalAirport?.trim() && ob.arrivalAirport?.trim())
        next.outboundArrivalAirport = ob.arrivalAirport
      if (!next.outboundDepartureAt && modetourLegDateTimeSlot(ob.departureDate, ob.departureTime))
        next.outboundDepartureAt = modetourLegDateTimeSlot(ob.departureDate, ob.departureTime)
      if (!next.outboundArrivalAt && modetourLegDateTimeSlot(ob.arrivalDate, ob.arrivalTime))
        next.outboundArrivalAt = modetourLegDateTimeSlot(ob.arrivalDate, ob.arrivalTime)
    }
    if (useIb && ib) {
      if (!next.inboundFlightNo?.trim() && ib.flightNo?.trim()) next.inboundFlightNo = ib.flightNo
      if (!next.inboundDepartureAirport?.trim() && ib.departureAirport?.trim())
        next.inboundDepartureAirport = ib.departureAirport
      if (!next.inboundArrivalAirport?.trim() && ib.arrivalAirport?.trim())
        next.inboundArrivalAirport = ib.arrivalAirport
      if (!next.inboundDepartureAt && modetourLegDateTimeSlot(ib.departureDate, ib.departureTime))
        next.inboundDepartureAt = modetourLegDateTimeSlot(ib.departureDate, ib.departureTime)
      if (!next.inboundArrivalAt && modetourLegDateTimeSlot(ib.arrivalDate, ib.arrivalTime))
        next.inboundArrivalAt = modetourLegDateTimeSlot(ib.arrivalDate, ib.arrivalTime)
    }
    return next
  })
}

export function expandModetourFlightRawForDirectedParse(snapshot: DetailBodyParseSnapshot): DetailBodyParseSnapshot {
  const isMod =
    snapshot.brandKey?.trim() === 'modetour' ||
    snapshot.flightStructured.debug?.supplierBrandKey === 'modetour'
  if (!isMod) return snapshot
  const fr = (snapshot.raw.flightRaw ?? '').trim()
  if (buildModetourDirectedSegmentLinesFromFlightRaw(fr || null)) return snapshot
  const full = (snapshot.normalizedRaw ?? '').trim()
  if (full && buildModetourDirectedSegmentLinesFromFlightRaw(full)) {
    return {
      ...snapshot,
      raw: { ...snapshot.raw, flightRaw: full },
    }
  }
  return snapshot
}

export function resolveModetourDirectedDepartureReturnLines(detailBody: DetailBodyParseSnapshot): {
  departureSegmentFromStructured: string | null
  returnSegmentFromStructured: string | null
} {
  let departureSegmentFromStructured: string | null = null
  let returnSegmentFromStructured: string | null = null

  if (detailBody.brandKey === 'modetour') {
    const fromRaw = buildModetourDirectedSegmentLinesFromFlightRaw(
      (detailBody.raw.flightRaw ?? '').trim() || null
    )
    if (fromRaw) {
      departureSegmentFromStructured = fromRaw.departureLine
      returnSegmentFromStructured = fromRaw.returnLine
    }
  }

  if (departureSegmentFromStructured == null || returnSegmentFromStructured == null) {
    const det = resolveDirectedFlightLinesDeterministicOnly(detailBody)
    departureSegmentFromStructured = departureSegmentFromStructured ?? det.departureSegmentFromStructured
    returnSegmentFromStructured = returnSegmentFromStructured ?? det.returnSegmentFromStructured
  }

  return { departureSegmentFromStructured, returnSegmentFromStructured }
}
