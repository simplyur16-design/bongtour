/**
 * 참좋은여행(verygoodtour) 블록형 항공 — 공개 상세 카드용 leg 조립.
 * modetour·스크래퍼와 무관; `FlightStructuredBody` 원문만 사용.
 */

import { departureLegHasContent, type DepartureLegCard } from '@/lib/departure-key-facts'
import type { FlightStructuredBody } from '@/lib/public-product-extras'
import {
  extractAirlineNameFromSupplierFlightBlock,
  extractFlightLegsFromSupplierText,
  splitOutboundInboundBlocks,
  type ExtractedLeg,
} from '@/lib/flight-leg-heuristics'

/** 참좋은 본문 날짜·시각·장소·출발|도착 한 줄 패턴 (공급사 전용) */
const VERYGOOD_DATETIME_LINE =
  /^(\d{4})\.(\d{1,2})\.(\d{1,2})\s*\(([^)]+)\)\s+(\d{1,2}:\d{2})\s+(.+?)\s+(출발|도착)\s*$/

function formatLegDateTime(y: string, mo: string, d: string, wd: string, hm: string): string {
  const mm = mo.padStart(2, '0')
  const dd = d.padStart(2, '0')
  return `${y}.${mm}.${dd}(${wd}) ${hm}`
}

/** 공항 접미사만 정리 — 도시명은 유지 */
function normalizePlaceToken(p: string): string {
  return p
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(?:국제)?공항$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractFlightNo(block: string): string | null {
  const m = block.match(/\b([A-Z]{2}\d{2,4})\b/)
  return m ? m[1] : null
}

/**
 * 출국/가는편 블록 한 덩어리에서 첫 출발·첫 도착 줄만으로 카드 구성.
 */
function legCardFromSegmentBlock(block: string): DepartureLegCard | null {
  if (!block.trim()) return null
  const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  let departureAirport: string | null = null
  let departureAtText: string | null = null
  let arrivalAirport: string | null = null
  let arrivalAtText: string | null = null
  for (const ln of lines) {
    const m = ln.match(VERYGOOD_DATETIME_LINE)
    if (!m) continue
    const [, y, mo, d, wd, hm, placeRaw, kind] = m
    const dt = formatLegDateTime(y, mo, d, wd, hm)
    const place = normalizePlaceToken(placeRaw)
    if (!place) continue
    if (kind === '출발') {
      if (!departureAirport) {
        departureAirport = place
        departureAtText = dt
      }
    } else {
      if (!arrivalAirport) {
        arrivalAirport = place
        arrivalAtText = dt
      }
    }
  }
  const flightNo = extractFlightNo(block)
  if (!departureAirport && !arrivalAirport && !departureAtText && !arrivalAtText && !flightNo) return null
  return {
    departureAirport,
    departureAtText,
    arrivalAirport,
    arrivalAtText,
    flightNo,
    flightDurationText: null,
  }
}

function legCardFromExtractedLeg(ex: ExtractedLeg): DepartureLegCard | null {
  const flightNo = ex.flightNos[0] ?? null
  if (!ex.departurePlace?.trim() && !ex.arrivalPlace?.trim() && !flightNo) return null
  return {
    departureAirport: ex.departurePlace,
    departureAtText: null,
    arrivalAirport: ex.arrivalPlace,
    arrivalAtText: null,
    flightNo,
    flightDurationText: null,
  }
}

function splitVerygoodOutboundInbound(full: string): { outbound: string; inbound: string } {
  const t = full.replace(/\r/g, '\n')
  const markOut = /(?:^|\n)\s*출국\s*(?:\n|$)/im
  const markIn = /(?:^|\n)\s*입국\s*(?:\n|$)/im
  const iOut = t.search(markOut)
  const iIn = t.search(markIn)
  if (iOut >= 0 && iIn > iOut) {
    const tail = t.slice(iOut).replace(/^\s*출국\s*/im, '')
    const relIn = tail.search(markIn)
    if (relIn >= 0) {
      return {
        outbound: tail.slice(0, relIn).trim(),
        inbound: tail.slice(relIn).replace(/^\s*입국\s*/im, '').trim(),
      }
    }
    return { outbound: tail.trim(), inbound: '' }
  }
  return splitOutboundInboundBlocks(t)
}

/** 항공사 추출용 — 상단 메타·전체 본문이 아니라 항공 블록 필드만 */
export function getVerygoodFlightBlockHaystack(flight: FlightStructuredBody | null | undefined): string {
  if (!flight) return ''
  return [flight.flightRaw, flight.departureSegmentText, flight.returnSegmentText]
    .filter((x): x is string => Boolean(x?.trim()))
    .join('\n\n')
}

/**
 * 공개 상세에 잘못 들어온 상품코드·URL·탭메뉴 등이 항공사명으로 취급된 경우.
 */
export function isVerygoodAirlineMetaPollution(s: string | null | undefined): boolean {
  if (!s?.trim()) return false
  const t = s.trim()
  const compact = t.replace(/\s+/g, '')
  if (compact.length > 42) return true
  if (
    /상품코드|ProCode|복사|단축|인쇄|인쇄하기|여행상품|핵심정보|일정예정|가격예정|항공예정|숙박미정|미정인솔|인솔자동|\bURL\b/i.test(
      t
    )
  )
    return true
  if (/EPP[A-Z0-9-]{5,}/i.test(t)) return true
  return false
}

/**
 * 공개 상세·출발별 facts·메타칩용 항공사명 — 항공 블록 haystack의 알려진 항공사 매칭을 최우선.
 */
export function resolveVerygoodPublicAirlineForPublicDetail(
  flight: FlightStructuredBody | null | undefined,
  factsAirline: string | null | undefined,
  productAirline: string | null | undefined
): string | null {
  const hay = getVerygoodFlightBlockHaystack(flight)
  const fromBlock = hay.trim() ? extractAirlineNameFromSupplierFlightBlock(hay) : null
  if (fromBlock) return fromBlock

  const structuredName = flight?.airlineName?.trim()
  if (structuredName && !isVerygoodAirlineMetaPollution(structuredName)) return structuredName

  const fa = factsAirline?.trim()
  if (fa && !isVerygoodAirlineMetaPollution(fa)) return fa

  const pa = productAirline?.trim()
  if (pa && !isVerygoodAirlineMetaPollution(pa)) return pa

  return null
}

/**
 * 참좋은형 날짜·시각 한 줄이 있으면 전용 줄 파서 우선.
 * 패턴이 없거나 한쪽만 비면 `departureSegmentText`·`returnSegmentText`·`flightRaw`를
 * `extractFlightLegsFromSupplierText`로 보강(공개 상세 카드 폴백).
 */
export function tryVerygoodLegsFromFlightBody(
  flight: FlightStructuredBody | null | undefined
): { outbound: DepartureLegCard | null; inbound: DepartureLegCard | null } | null {
  if (!flight) return null
  const raw = getVerygoodFlightBlockHaystack(flight)
  if (!raw.trim()) return null

  let outbound: DepartureLegCard | null = null
  let inbound: DepartureLegCard | null = null

  const sample = raw.split(/\r?\n/).some((l) => VERYGOOD_DATETIME_LINE.test(l.trim()))
  if (sample) {
    const { outbound: obText, inbound: ibText } = splitVerygoodOutboundInbound(raw)
    outbound = legCardFromSegmentBlock(obText)
    inbound = legCardFromSegmentBlock(ibText)
  }

  const segSources = [flight.departureSegmentText, flight.returnSegmentText, flight.flightRaw].filter(
    (x): x is string => Boolean(x?.trim())
  )
  if (segSources.length) {
    const { outbound: exOb, inbound: exIb } = extractFlightLegsFromSupplierText(segSources)
    if (!departureLegHasContent(outbound)) {
      const fb = legCardFromExtractedLeg(exOb)
      if (fb) outbound = fb
    }
    if (!departureLegHasContent(inbound)) {
      const fb = legCardFromExtractedLeg(exIb)
      if (fb) inbound = fb
    }
  }

  if (!outbound && !inbound) return null
  return { outbound, inbound }
}
