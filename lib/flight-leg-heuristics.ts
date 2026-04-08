/**
 * 공급사 복붙 본문에서 항공 가는편/오는편을 같은 블록 단위로 보강 추출한다.
 * LLM이 누락한 출발/도착지(도시·공항)를 정규식으로 보완한다.
 */

import type { ParsedProductPrice } from '@/lib/parsed-product-types'
import { preferRicherPlaceName } from '@/lib/flight-place-preference'
import { pickReturnDateCandidateFromRawText } from '@/lib/hero-date-utils'

export type FlightEnrichmentIssue = {
  field: string
  reason: string
  source: 'auto'
  severity: 'warn'
}

function trimPlace(s: string | null | undefined): string | null {
  if (!s) return null
  const t = s.replace(/\s+/g, ' ').trim()
  if (!t || t === '—' || t === '-') return null
  return t.length > 64 ? t.slice(0, 64) : t
}

/** "인천 → 연길", "인천-연길", "인천 ➝ 연길", "ICN → YNJ" */
function extractArrowRoute(line: string): { from: string; to: string } | null {
  const iata = line.match(/\b([A-Z]{3})\s*[→➝>＞－\-~～]\s*([A-Z]{3})\b/)
  if (iata) {
    const from = trimPlace(iata[1])
    const to = trimPlace(iata[2])
    if (from && to) return { from, to }
  }
  const m = line.match(
    /([가-힣A-Za-z0-9·\s]{2,52}?)\s*[→➝>＞－\-~～]\s*([가-힣A-Za-z0-9·\s]{2,52})/
  )
  if (!m) return null
  const from = trimPlace(m[1].replace(/\d{4}[.\-/년].*$/u, '').trim())
  const to = trimPlace(m[2].replace(/^\d{4}[.\-/년].*$/u, '').trim())
  if (!from || !to) return null
  return { from, to }
}

/** 공항명(국제공항·공항) 우선, 없으면 시각 앞 마지막 토큰 */
function pickAirportOrPlaceToken(s: string): string | null {
  const airportRe = /([가-힣]{2,28}(?:국제공항|공항))/gu
  const ap = [...s.matchAll(airportRe)]
  if (ap.length) return trimPlace(ap[ap.length - 1]?.[1])
  const cityTok = /([가-힣]{2,14}(?:국제공항|공항)?)/gu
  const cities = [...s.matchAll(cityTok)]
  if (cities.length) return trimPlace(cities[cities.length - 1]?.[1])
  return null
}

/** "2026.07.07(화) 인천국제공항 19:20 → 연길조양천국제공항 20:40" 등 — 공항명 우선 */
function extractPlacesFromKoreanDatetimeLine(ln: string): { from: string; to: string } | null {
  if (!/[→➝]/.test(ln) || !/\d{1,2}:\d{2}/.test(ln)) return null
  const segs = ln.split(/[→➝]/).map((s) => s.trim())
  if (segs.length < 2) return null
  const from = pickAirportOrPlaceToken(segs[0])
  const to = pickAirportOrPlaceToken(segs[1])
  if (from && to && from !== to) return { from, to }
  return null
}

/** 줄에 "OO출발" "OO도착" (모두/참좋은 등) */
function extractDepArrLabels(block: string): { dep: string | null; arr: string | null } {
  const dep =
    block.match(/([가-힣A-Za-z0-9]+(?:국제공항|공항)?)\s*출발/u)?.[1] ??
    block.match(/출발\s*[:：]?\s*([가-힣A-Za-z0-9]+(?:국제공항|공항)?)/u)?.[1] ??
    null
  const arr =
    block.match(/([가-힣A-Za-z0-9]+(?:국제공항|공항)?)\s*도착/u)?.[1] ??
    block.match(/도착\s*[:：]?\s*([가-힣A-Za-z0-9]+(?:국제공항|공항)?)/u)?.[1] ??
    null
  return { dep: trimPlace(dep), arr: trimPlace(arr) }
}

function extractFlightNos(block: string): string[] {
  const all = block.match(/\b([A-Z]{2}\d{2,4})\b/g)
  return all ? [...new Set(all)] : []
}

const AIRLINE_RE =
  /(대한항공|아시아나항공|제주항공|진에어|티웨이항공|에어부산|에어서울|이스타항공|에어프레미아|플라이강원|중국남방항공|중국동방항공|중국국제항공|에어차이나|샤먼항공|하이난항공|델타항공|유나이티드항공|아메리칸항공|ANA|JAL|일본항공|싱가포르항공|타이항공|에바항공|카타르항공|에미레이트항공|튀르키예항공|에어프랑스|루프트한자|KLM|핀에어|에어캐나다|에어아스타나)/u

export function extractAirlineNameFromSupplierFlightBlock(block: string): string | null {
  if (!block?.trim()) return null
  const m = block.match(AIRLINE_RE)
  return m ? m[1].trim() : null
}

function extractAirlineName(block: string): string | null {
  return extractAirlineNameFromSupplierFlightBlock(block)
}

export function splitOutboundInboundBlocks(full: string): { outbound: string; inbound: string } {
  const t = full.replace(/\r/g, '\n')
  const go = /(?:^|\n)\s*(?:가는\s*편|출국|출발\s*편)(?:\s*[:\[【\(])?/i
  const back = /(?:^|\n)\s*(?:오는\s*편|입국|귀국\s*편|귀국)(?:\s*[:\[【\(])?/i
  const iGo = t.search(go)
  const iBack = t.search(back)
  if (iGo >= 0 && iBack > iGo) {
    const afterGo = t.slice(iGo).replace(go, '')
    const relBack = afterGo.search(back)
    if (relBack >= 0) {
      return {
        outbound: afterGo.slice(0, relBack).trim(),
        inbound: afterGo.slice(relBack).replace(back, '').trim(),
      }
    }
    return { outbound: afterGo.trim(), inbound: '' }
  }
  if (iBack >= 0 && (iGo < 0 || iGo > iBack)) {
    return { outbound: t.slice(0, iBack).trim(), inbound: t.slice(iBack).replace(back, '').trim() }
  }
  return { outbound: t.trim(), inbound: '' }
}

export type ExtractedLeg = {
  departurePlace: string | null
  arrivalPlace: string | null
  flightNos: string[]
  airline: string | null
}

/**
 * 날짜·시각 줄(또는 인접 줄) 주변에서 화살표·출발/도착 라벨을 재탐색한다.
 * LLM이 시간만 넣고 같은 블록의 도시명을 놓친 경우 보완.
 */
function inferPlacesFromTimeAdjacentLines(block: string): { from: string; to: string } | null {
  const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean)
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]
    const kd = extractPlacesFromKoreanDatetimeLine(ln.replace(/\s+/g, ' '))
    if (kd?.from && kd?.to) return kd
    const hasTime = /\d{1,2}:\d{2}/.test(ln) || /\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}/.test(ln)
    if (!hasTime) continue
    const window = [lines[i - 2], lines[i - 1], ln, lines[i + 1], lines[i + 2]]
      .filter(Boolean)
      .join('\n')
    const flat = window.replace(/\s+/g, ' ').trim()
    const r =
      extractArrowRoute(flat) ??
      extractArrowRoute(ln) ??
      extractPlacesFromKoreanDatetimeLine(ln.replace(/\s+/g, ' '))
    if (r?.from && r?.to) return r
    const da = extractDepArrLabels(window)
    if (da.dep && da.arr) return { from: da.dep, to: da.arr }
  }
  for (let i = 0; i < lines.length; i++) {
    const tri = [lines[i], lines[i + 1], lines[i + 2], lines[i + 3]].filter(Boolean).join('\n')
    const r = extractArrowRoute(tri.replace(/\s+/g, ' '))
    if (r?.from && r?.to) return r
  }
  return null
}

/**
 * 공급사 항공 블록 문자열에서 출발/도착지·편명·항공사를 한 덩어리로 추출.
 * (등록 파이프라인·상세 보강에서 공통 사용)
 */
export function extractLegPlacesFromSupplierBlock(block: string): ExtractedLeg {
  return parseLegBlock(block)
}

function parseLegBlock(block: string): ExtractedLeg {
  if (!block.trim()) {
    return { departurePlace: null, arrivalPlace: null, flightNos: [], airline: null }
  }
  const flat = block.replace(/\s+/g, ' ').trim()
  let departurePlace: string | null = null
  let arrivalPlace: string | null = null

  const routeLine = extractArrowRoute(flat)
  if (routeLine) {
    departurePlace = routeLine.from
    arrivalPlace = routeLine.to
  }
  if (!departurePlace || !arrivalPlace) {
    const kd0 = extractPlacesFromKoreanDatetimeLine(flat)
    if (kd0?.from && kd0?.to) {
      departurePlace = kd0.from
      arrivalPlace = kd0.to
    }
  }
  if (!departurePlace || !arrivalPlace) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
    for (const ln of lines) {
      const kd = extractPlacesFromKoreanDatetimeLine(ln.replace(/\s+/g, ' '))
      if (kd?.from && kd?.to) {
        departurePlace = kd.from
        arrivalPlace = kd.to
        break
      }
      const route = extractArrowRoute(ln)
      if (route) {
        departurePlace = route.from
        arrivalPlace = route.to
        break
      }
    }
  }
  if (!departurePlace || !arrivalPlace) {
    const { dep, arr } = extractDepArrLabels(block)
    if (dep) departurePlace = departurePlace ?? dep
    if (arr) arrivalPlace = arrivalPlace ?? arr
  }
  if (!departurePlace || !arrivalPlace) {
    const dual = block.match(
      /출발지\s*[:：]?\s*([가-힣A-Za-z0-9\s·]+?)\s+(?:도착지|도착)\s*[:：]?\s*([가-힣A-Za-z0-9\s·]+)/u
    )
    if (dual) {
      departurePlace = departurePlace ?? trimPlace(dual[1])
      arrivalPlace = arrivalPlace ?? trimPlace(dual[2])
    }
  }
  if (!departurePlace || !arrivalPlace) {
    const near = inferPlacesFromTimeAdjacentLines(block)
    if (near) {
      departurePlace = departurePlace ?? near.from
      arrivalPlace = arrivalPlace ?? near.to
    }
  }
  return {
    departurePlace,
    arrivalPlace,
    flightNos: extractFlightNos(block),
    airline: extractAirlineName(block),
  }
}

export function extractFlightLegsFromSupplierText(sources: string[]): {
  outbound: ExtractedLeg
  inbound: ExtractedLeg
} {
  const merged = sources.filter(Boolean).join('\n\n')
  const { outbound: ob, inbound: ib } = splitOutboundInboundBlocks(merged)
  const obContent = ib.trim() ? ob : merged
  const out = parseLegBlock(obContent)
  let inn = parseLegBlock(ib)
  if (!inn.departurePlace && !inn.arrivalPlace && !ib.trim()) {
    const tail = merged.split(/(?:오는\s*편|입국|귀국)/i).pop() ?? ''
    if (tail && tail !== merged) {
      const second = parseLegBlock(tail)
      if (second.departurePlace || second.arrivalPlace) inn = second
    }
  }
  return { outbound: out, inbound: inn }
}

function hasAnyTime(p: ParsedProductPrice, leg: 'out' | 'in'): boolean {
  if (leg === 'out') {
    return Boolean(p.outboundDepartureAt || p.outboundArrivalAt)
  }
  return Boolean(p.inboundDepartureAt || p.inboundArrivalAt)
}

function hasBothPlaces(
  dep: string | null | undefined,
  arr: string | null | undefined
): boolean {
  return Boolean(dep?.trim() && arr?.trim())
}

/**
 * 상품 단위 segment 문자열에서 화살표/라벨로 장소 보강.
 */
export function mergeProductLevelFlightSegments(
  raw: Record<string, unknown>,
  prices: ParsedProductPrice[]
): ParsedProductPrice[] {
  if (!prices.length) return prices
  const depSeg = typeof raw.departureSegmentText === 'string' ? raw.departureSegmentText : ''
  const retSeg = typeof raw.returnSegmentText === 'string' ? raw.returnSegmentText : ''
  const routeRaw = typeof raw.routeRaw === 'string' ? raw.routeRaw : ''
  const obFrom = extractArrowRoute(depSeg) ?? extractArrowRoute(routeRaw)
  const inFrom = extractArrowRoute(retSeg)
  return prices.map((p) => {
    const next = { ...p }
    if (obFrom) {
      next.outboundDepartureAirport = preferRicherPlaceName(next.outboundDepartureAirport, obFrom.from)
      next.outboundArrivalAirport = preferRicherPlaceName(next.outboundArrivalAirport, obFrom.to)
    }
    if (inFrom) {
      next.inboundDepartureAirport = preferRicherPlaceName(next.inboundDepartureAirport, inFrom.from)
      next.inboundArrivalAirport = preferRicherPlaceName(next.inboundArrivalAirport, inFrom.to)
    }
    return next
  })
}

/**
 * 공급사 텍스트 휴리스틱으로 각 출발일 행의 항공 필드를 보강한다.
 * 시간만 있고 장소가 비어 있으면(보강 후에도) appendIssues에 한 번씩만 경고한다.
 */
export function enrichParsedProductPricesWithFlightHeuristics(
  prices: ParsedProductPrice[],
  sources: string[]
): { prices: ParsedProductPrice[]; appendIssues: FlightEnrichmentIssue[] } {
  const appendIssues: FlightEnrichmentIssue[] = []
  if (!prices.length) return { prices, appendIssues }

  const merged = sources.filter(Boolean).join('\n\n')
  const { outbound: ex, inbound: ix } = extractFlightLegsFromSupplierText(sources)
  const globalFns = extractFlightNos(merged)
  const outFn = globalFns[0] ?? ex.flightNos[0] ?? null
  const inFn = globalFns[1] ?? ix.flightNos[0] ?? globalFns[0] ?? null

  const nextPrices = prices.map((p) => {
    const next: ParsedProductPrice = { ...p }
    const carrier = ex.airline ?? ix.airline
    if (carrier?.trim() && !next.carrierName?.trim()) next.carrierName = carrier

    if (ex.departurePlace) {
      next.outboundDepartureAirport = preferRicherPlaceName(next.outboundDepartureAirport, ex.departurePlace)
    }
    if (ex.arrivalPlace) {
      next.outboundArrivalAirport = preferRicherPlaceName(next.outboundArrivalAirport, ex.arrivalPlace)
    }
    if (ix.departurePlace) {
      next.inboundDepartureAirport = preferRicherPlaceName(next.inboundDepartureAirport, ix.departurePlace)
    }
    if (ix.arrivalPlace) {
      next.inboundArrivalAirport = preferRicherPlaceName(next.inboundArrivalAirport, ix.arrivalPlace)
    }
    if (outFn && !next.outboundFlightNo?.trim()) next.outboundFlightNo = outFn
    if (inFn && !next.inboundFlightNo?.trim()) next.inboundFlightNo = inFn

    return next
  })

  const probe = nextPrices[0]
  if (probe) {
    if (
      hasAnyTime(probe, 'out') &&
      !hasBothPlaces(probe.outboundDepartureAirport, probe.outboundArrivalAirport)
    ) {
      appendIssues.push({
        field: 'outboundDeparturePlace',
        reason: '항공 블록에 시간은 있으나 출발지 구조화 실패',
        source: 'auto',
        severity: 'warn',
      })
    }
    if (
      hasAnyTime(probe, 'in') &&
      !hasBothPlaces(probe.inboundDepartureAirport, probe.inboundArrivalAirport)
    ) {
      appendIssues.push({
        field: 'inboundDeparturePlace',
        reason: '항공 블록에 시간은 있으나 귀국편 장소 구조화 실패',
        source: 'auto',
        severity: 'warn',
      })
    }
  }

  return { prices: nextPrices, appendIssues }
}

/**
 * LLM/달력 행에 inbound 도착 시각이 비어 있을 때, 복붙 본문에서 귀국일 후보(문맥 가중)로 날짜만 보강.
 * 시각·편명은 원문 검수 전제(날짜만 채움).
 */
export function enrichParsedPricesInboundArrivalDateFromRawBlob(
  prices: ParsedProductPrice[],
  rawBlob: string | null | undefined
): { prices: ParsedProductPrice[]; appendIssues: FlightEnrichmentIssue[] } {
  const appendIssues: FlightEnrichmentIssue[] = []
  if (!prices.length || !rawBlob?.trim()) return { prices, appendIssues }
  const blob = rawBlob.replace(/\r/g, '\n')
  let filled = 0
  const next = prices.map((p) => {
    if (p.inboundArrivalAt?.trim()) return p
    const depIso = p.date?.slice(0, 10) ?? null
    const retIso = pickReturnDateCandidateFromRawText(blob, depIso)
    if (!retIso) return p
    filled++
    return { ...p, inboundArrivalAt: `${retIso}T12:00:00` }
  })
  if (filled > 0) {
    appendIssues.push({
      field: 'inboundArrivalAt',
      reason: `inboundArrivalAt가 비었던 ${filled}개 출발행에 원문 귀국일 후보(문맥 가중)로 날짜만 보강했습니다. 시각·편명은 원문 검수.`,
      source: 'auto',
      severity: 'warn',
    })
  }
  return { prices: next, appendIssues }
}
