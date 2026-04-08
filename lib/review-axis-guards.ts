import type { FlightStructured } from '@/lib/detail-body-parser'

/** `항공` 앵커 섹션이 있고 실질 본문이 있을 때 */
const MIN_FLIGHT_SECTION_CHARS = 28
/** detail-body 파이프라인과 동일: flight seed(항공+일정+요약)가 이 길이 미만이면 전체 본문을 항공 파싱에 넣음 → 교차 오염 위험 */
const WEAK_SEED_MAX = 79

function getSectionText(sections: Array<{ type: string; text: string }>, t: string): string {
  return sections.find((s) => s.type === t)?.text?.trim() ?? ''
}

function hasStructuralFlightSignals(fs: FlightStructured): boolean {
  const ob = fs.outbound
  const ib = fs.inbound
  return !!(
    ob.departureAirport ||
    ob.arrivalAirport ||
    ob.departureAirportCode ||
    ob.arrivalAirportCode ||
    ib.departureAirport ||
    ib.arrivalAirport ||
    ib.departureAirportCode ||
    ib.arrivalAirportCode ||
    ob.departureDate ||
    ob.departureTime ||
    ob.arrivalDate ||
    ob.arrivalTime ||
    ib.departureDate ||
    ib.departureTime ||
    ib.arrivalDate ||
    ib.arrivalTime ||
    ob.flightNo ||
    ib.flightNo ||
    fs.airlineName?.trim()
  )
}

/** 단일 '출발' 같은 동선 단어로는 true가 되지 않게 — 공항/편명/항공 키 중심 */
function rawLooksFlightLike(raw: string): boolean {
  const t = raw.replace(/\s+/g, ' ')
  if (!t.trim()) return false
  return (
    /\([A-Z]{3}\)|\bICN\b|\bGMP\b|\bPUS\b|\bNRT\b|\bKIX\b|\bHAN\b|\bSGN\b/i.test(t) ||
    /\b[A-Z]{2,3}\d{3,4}\b/.test(t) ||
    /(공항|출국|입국).{0,48}(출발|도착)/i.test(t) ||
    /항공\s*편|편명|flight\s*no/i.test(t)
  )
}

function mergeOptionalText(sections: Array<{ type: string; text: string }>, optionalPaste?: string | null): string {
  const a = optionalPaste?.trim()
  if (a) return a
  return getSectionText(sections, 'optional_tour_section')
}

function mergeShoppingText(sections: Array<{ type: string; text: string }>, shoppingPaste?: string | null): string {
  const a = shoppingPaste?.trim()
  if (a) return a
  return getSectionText(sections, 'shopping_section')
}

/** 옵션관광 표 강한 신호 — 2개 이상 동시에 맞을 때만 */
export function hasStrongOptionalTourTableSignals(text: string): boolean {
  const t = text.replace(/\s+/g, ' ')
  if (!t) return false
  const signals = [
    /선택관광명|선택\s*관광/i.test(t),
    /(?:성인|아동).{0,40}(?:원|USD|\$|달러)/i.test(t),
    /최소\s*\d*\s*명|최소인원/i.test(t),
    /미참여\s*시\s*대기|대기\s*장소/i.test(t),
    /(?:가이드|인솔).{0,12}동행/i.test(t),
    /소요\s*시간/i.test(t) && /(?:분|시간)/.test(t),
  ]
  return signals.filter(Boolean).length >= 2
}

/** 쇼핑 고지/표 강한 신호 — 2개 이상 동시에 맞을 때만 */
export function hasStrongShoppingBlockSignals(text: string): boolean {
  const t = text.replace(/\s+/g, ' ')
  if (!t) return false
  const signals = [
    /쇼핑\s*\d+\s*회|총\s*\d+\s*회.*쇼핑/i.test(t),
    /쇼핑\s*품목|쇼핑장소|매장/i.test(t),
    /환불\s*여부|교환|소비자\s*고지/i.test(t),
  ]
  return signals.filter(Boolean).length >= 2
}

/**
 * 항공 축 검수(편명·항공사·구조화 실패·항공 Gemini 보정) 적용 여부.
 * 쇼핑/옵션 전용 붙여넣기나 짧은 본문에서 항공 파서가 부분 매칭해도 항공 경고를 내지 않는다.
 */
export function isFlightAxisEngaged(args: {
  flightStructured: FlightStructured
  sections: Array<{ type: string; text: string }>
  optionalPasteRaw?: string | null
  shoppingPasteRaw?: string | null
}): boolean {
  const fs = args.flightStructured
  const sections = args.sections

  const flightSectionText = getSectionText(sections, 'flight_section')
  if (flightSectionText.length >= MIN_FLIGHT_SECTION_CHARS) return true

  if (hasStructuralFlightSignals(fs)) return true

  const optionalText = mergeOptionalText(sections, args.optionalPasteRaw)
  const shoppingText = mergeShoppingText(sections, args.shoppingPasteRaw)

  const seedLen = [
    flightSectionText,
    getSectionText(sections, 'schedule_section'),
    getSectionText(sections, 'summary_section'),
  ]
    .filter(Boolean)
    .join('\n').length
  const weakSeed = seedLen < WEAK_SEED_MAX

  if (weakSeed && (hasStrongShoppingBlockSignals(shoppingText) || hasStrongOptionalTourTableSignals(optionalText))) {
    return false
  }

  const d = fs.debug
  const rawJoin = `${d?.selectedOutRaw ?? ''}\n${d?.selectedInRaw ?? ''}`

  if ((d?.secondaryScanBlockCount ?? 0) > 0 && rawJoin.trim() && rawLooksFlightLike(rawJoin)) return true

  if (!weakSeed && (d?.status === 'success' || d?.status === 'partial')) return true

  if (weakSeed && rawJoin.trim() && rawLooksFlightLike(rawJoin)) return true

  return false
}
