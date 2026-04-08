import type { FlightStructured } from '@/lib/detail-body-parser-types'
import { createEmptyFlightLeg, stripLogoNoise } from '@/lib/flight-parser-generic'

type FlightLeg = FlightStructured['outbound']

/** `【출국】` 등 괄호형 헤더를 `출국`/`입국` 앵커로 바꿔 블록 분리·교정 미리보기 evidence가 잡히게 함 */
export function normalizeVerygoodFlightSectionDecorators(section: string): string {
  return (
    section
      .replace(/【\s*출국\s*】/gi, '출국')
      .replace(/【\s*입국\s*】/gi, '입국')
      .replace(/［\s*출국\s*］/gi, '출국')
      .replace(/［\s*입국\s*］/gi, '입국')
      .replace(/\uff3b\s*출국\s*\uff3d/gi, '출국')
      .replace(/\uff3b\s*입국\s*\uff3d/gi, '입국')
      .replace(/\[\s*출국\s*\]/gi, '출국')
      .replace(/\[\s*입국\s*\]/gi, '입국')
  )
}

/** `2026.05.15 (금) 10:50 인천 출발` */
const VERYGOOD_FLIGHT_LINE =
  /^(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})\s+\(([^)]*)\)\s+([0-2]?\d:[0-5]\d)\s+(.+?)\s+(출발|도착)\s*$/i

function stripVerygoodRegisterFlightNoise(raw: string): string {
  let t = raw.replace(/\r/g, '\n')
  /** 닫는 따옴표 없이 `…습니다항공여정보기` 로 이어지는 붙여넣기 (ASCII·유니코드 여는 따옴표) */
  t = t.replace(/['\u2018\u201c][^'\r\n\u2019\u201d]{20,2500}?(?=항공여정보기)/gu, ' ')
  t = t.replace(/항공여정보기/g, '\n')
  t = t.replace(/출발일변경/g, '\n')
  t = t.replace(/'[^']{20,2500}'/g, ' ')
  t = t.replace(/(\d+박\d+일)(?=[가-힣A-Za-z])/g, '$1\n')
  return t
}

function extractVerygoodAirlineName(blob: string): string | null {
  const flat = blob.replace(/\s+/g, ' ').trim().slice(0, 220)
  const hits = [...flat.matchAll(/([가-힣]{2,10}항공)/g)].map((x) => x[1]!)
  if (!hits.length) return null
  const uniq = [...new Set(hits)]
  return uniq[0] ?? null
}

function lineIndexOfAnchor(lines: string[], re: RegExp): number {
  return lines.findIndex((l) => re.test(l.replace(/\s+/g, ' ').trim()))
}

function parseVerygoodTourLegFromBlock(blockLines: string[]): {
  leg: FlightLeg
  rawPair: [string, string]
} | null {
  type Row = { date: string; time: string; city: string; kind: string; raw: string }
  const rows: Row[] = []
  for (const line of blockLines) {
    const t = line.replace(/\s+/g, ' ').trim()
    if (!t) continue
    const m = t.match(VERYGOOD_FLIGHT_LINE)
    if (!m) continue
    const date = m[1]!.replace(/\./g, '-').replace(/\//g, '-')
    rows.push({
      date,
      time: m[3]!,
      city: m[4]!.trim(),
      kind: m[5]!,
      raw: t,
    })
  }
  if (rows.length < 2) return null
  const a = rows[0]!
  const b = rows[1]!
  if (a.kind !== '출발' || b.kind !== '도착') return null
  const empty = createEmptyFlightLeg()
  return {
    leg: {
      ...empty,
      departureAirport: a.city,
      departureDate: a.date,
      departureTime: a.time,
      arrivalAirport: b.city,
      arrivalDate: b.date,
      arrivalTime: b.time,
    },
    rawPair: [a.raw, b.raw],
  }
}

function legCoreCount(leg: FlightLeg): number {
  return [
    leg.departureAirport,
    leg.departureDate,
    leg.departureTime,
    leg.arrivalAirport,
    leg.arrivalDate,
    leg.arrivalTime,
  ].filter(Boolean).length
}

/**
 * 참좋은여행(verygoodtour) 관리자 항공 붙여넣기 전용 — 노이즈 제거·`출국`/`입국`·일시+공항+출발/도착 줄.
 * (공용 `parseFlightSectionGeneric` 미사용)
 */
export function parseFlightSectionVerygoodtour(
  section: string,
  fullBodyForSecondary?: string | null
): FlightStructured {
  /** 항공 슬라이스에 출국/입국이 없으면 전체 본문으로 재시도(앵커 분리 누락 대비) */
  let source = section
  if (
    fullBodyForSecondary?.trim() &&
    (!/(^|\n)출국\s*(?:\n|$)/m.test(source) || !/(^|\n)입국\s*(?:\n|$)/m.test(source))
  ) {
    source = fullBodyForSecondary
  }
  const sectionClean = stripLogoNoise(normalizeVerygoodFlightSectionDecorators(source))
  const stripped = stripVerygoodRegisterFlightNoise(sectionClean)
  const airlineName = extractVerygoodAirlineName(stripped) ?? extractVerygoodAirlineName(sectionClean)
  const lines = stripped.split('\n')
  /** JS `\b`는 한글 단어 경계로 동작하지 않음 — 줄 전체가 `출국`/`입국`인 경우만 앵커 */
  const idxOut = lineIndexOfAnchor(lines, /^출국\s*$/i)
  const idxIn = lineIndexOfAnchor(lines, /^입국\s*$/i)
  const empty = createEmptyFlightLeg()
  const supplierBrandKey = 'verygoodtour'
  const expectFlightNumber = false

  const fail = (reason: string): FlightStructured => ({
    airlineName,
    outbound: empty,
    inbound: empty,
    rawFlightLines: lines.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 24),
    debug: {
      candidateCount: 0,
      selectedOutRaw: null,
      selectedInRaw: null,
      partialStructured: false,
      status: 'failure',
      exposurePolicy: 'admin_only',
      secondaryScanBlockCount: 0,
      secondaryFlightSnippet: null,
      supplierBrandKey,
      expectFlightNumber,
    },
    reviewNeeded: true,
    reviewReasons: [reason],
  })

  if (idxOut < 0 || idxIn < 0 || idxIn <= idxOut) {
    if (fullBodyForSecondary?.trim() && source.trim() !== fullBodyForSecondary.trim()) {
      return parseFlightSectionVerygoodtour(fullBodyForSecondary, null)
    }
    return fail('참좋은 출국/입국 앵커를 찾지 못했습니다.')
  }

  const outBlock = lines.slice(idxOut + 1, idxIn)
  const inBlock = lines.slice(idxIn + 1)
  const ob = parseVerygoodTourLegFromBlock(outBlock)
  const ib = parseVerygoodTourLegFromBlock(inBlock)
  if (!ob || !ib) {
    if (fullBodyForSecondary?.trim() && source.trim() !== fullBodyForSecondary.trim()) {
      return parseFlightSectionVerygoodtour(fullBodyForSecondary, null)
    }
    return fail('참좋은 출국/입국 블록에서 일시·공항·출발/도착 줄을 읽지 못했습니다.')
  }

  const outbound = ob.leg
  const inbound = ib.leg
  const outCore = legCoreCount(outbound)
  const inCore = legCoreCount(inbound)
  const partialStructured = outCore >= 3 || inCore >= 3
  const successStructured = outCore >= 5 && inCore >= 5
  const status: 'success' | 'partial' | 'failure' = successStructured
    ? 'success'
    : partialStructured
      ? 'partial'
      : 'failure'
  const exposurePolicy =
    status === 'success' ? 'public_full' : status === 'partial' ? 'public_limited' : 'admin_only'
  const reviewReasons: string[] = []
  if (status !== 'success') reviewReasons.push('참좋은 항공 구조화 일부만 성공 — 원문 검수')

  const selectedOutRaw = ob.rawPair.join(' | ')
  const selectedInRaw = ib.rawPair.join(' | ')

  return {
    airlineName,
    outbound,
    inbound,
    rawFlightLines: [selectedOutRaw, selectedInRaw],
    debug: {
      candidateCount: 2,
      selectedOutRaw,
      selectedInRaw,
      partialStructured,
      status,
      exposurePolicy,
      secondaryScanBlockCount: 0,
      secondaryFlightSnippet: null,
      supplierBrandKey,
      expectFlightNumber,
    },
    reviewNeeded: status === 'failure',
    reviewReasons,
  }
}
