import type { FlightStructured } from '@/lib/detail-body-parser-types'
import { createEmptyFlightLeg, stripLogoNoise } from '@/lib/flight-parser-generic'

type FlightLeg = FlightStructured['outbound']

/** 끝에서만 매칭 — `ZE0535총05시간 50분 소요`처럼 편명에 붙은 `총`과 구분됨 */
const HANA_DURATION_TAIL =
  /(총\s*\d+\s*시간\s*\d+\s*분(?:\s*소요)?|총\s*\d+\s*시간(?:\s*소요)?|총\s*\d+\s*분(?:\s*소요)?)\s*$/iu

/** 본문/배너 문구가 항공사명으로 오인되지 않게 제외 */
const HANA_NON_AIRLINE_LINE =
  /안심\s*결제|Fair\s*Price|페어\s*프라이스|캠페인|프로모션|특가|혜택|이벤트|쿠폰|할인\s*안내|마일리지|포인트\s*적립/i

function isJunkHanatourAirlineLine(line: string | null | undefined): boolean {
  const t = (line ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return true
  if (HANA_NON_AIRLINE_LINE.test(t)) return true
  return false
}

/**
 * `출발 : … OZ0521총 14시간 30분 소요` 한 줄 — 날짜(요일)시각 2쌍·편명·소요 분리.
 */
function parseHanatourLabeledLegLine(line: string, kind: '출발' | '도착'): Partial<FlightLeg> | null {
  const flat = line.replace(/\s+/g, ' ').trim()
  const head = kind === '출발' ? /^출발\s*[:：]\s*(.+)$/i.exec(flat) : /^도착\s*[:：]\s*(.+)$/i.exec(flat)
  if (!head?.[1]) return null
  let rest = head[1]!.trim()
  let durationText: string | null = null
  const durM = rest.match(HANA_DURATION_TAIL)
  if (durM) {
    let d = durM[1]!.replace(/\s+/g, ' ').trim()
    d = d.replace(/총(?=\d)/gu, '총 ')
    d = d.replace(/\s+/g, ' ').trim()
    if (!/소요\s*$/iu.test(d)) d = `${d} 소요`
    durationText = d
    rest = rest.slice(0, durM.index).trim()
  }
  /** `ZE0535`, `7C850` 등 — 끝에서만 매칭 */
  const fnM = rest.match(/((?:\d[A-Z]{1,2}|[A-Z]{1,3})\d{2,5})(?:\s*총)?\s*$/i)
  let flightNo: string | null = null
  if (fnM) {
    flightNo = fnM[1]!.toUpperCase()
    rest = rest.slice(0, fnM.index).trim()
  }
  const dtRe =
    /(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})\s*\(([^)]*)\)\s*([0-2]?\d:[0-5]\d)/g
  const slots: { d: string; wk: string; t: string }[] = []
  let m: RegExpExecArray | null
  while ((m = dtRe.exec(rest)) !== null) {
    slots.push({ d: m[1]!, wk: m[2]!, t: m[3]! })
  }
  if (slots.length < 2) {
    return durationText ? { durationText } : null
  }
  const normDate = (d: string) => d.replace(/\./g, '-').replace(/\//g, '-')
  const depDateStr = `${normDate(slots[0]!.d)} (${slots[0]!.wk.replace(/\s+/g, ' ').trim()})`
  const arrDateStr = `${normDate(slots[1]!.d)} (${slots[1]!.wk.replace(/\s+/g, ' ').trim()})`
  return {
    departureAirport: null,
    departureAirportCode: null,
    arrivalAirport: null,
    arrivalAirportCode: null,
    departureDate: depDateStr,
    departureTime: slots[0]!.t,
    arrivalDate: arrDateStr,
    arrivalTime: slots[1]!.t,
    flightNo,
    durationText,
  }
}

function mergeLeg(base: FlightLeg, patch: Partial<FlightLeg> | null): FlightLeg {
  if (!patch) return { ...base }
  return {
    ...base,
    ...patch,
    durationText:
      patch.durationText != null && String(patch.durationText).trim() !== ''
        ? String(patch.durationText).trim()
        : base.durationText,
  }
}

function legCoreCount(leg: FlightLeg): number {
  return [
    leg.departureDate,
    leg.departureTime,
    leg.arrivalDate,
    leg.arrivalTime,
    leg.flightNo,
    leg.durationText,
  ].filter(Boolean).length
}

/**
 * 하나투어(hanatour) 관리자 항공 붙여넣기 전용 — 첫 줄 항공사 + `출발 :` / `도착 :` 한 줄 레그.
 * (공용 `parseFlightSectionGeneric` 미사용)
 *
 * 운영 입력 예외: 라벨 `도착 :` 한 줄은 UI/문서상 "도착"이지만 **귀국(오는편·inbound)** 레그로 해석한다.
 * 가는편은 오직 `출발 :` 줄만 사용한다.
 */
export function parseFlightSectionHanatour(
  section: string,
  _fullBodyForSecondary: string | null | undefined
): FlightStructured {
  const sectionClean = stripLogoNoise(section)
  const allLines = sectionClean
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  /** 본문 앞부분 잡문 + 뒤쪽 정형 항공칸이 붙은 경우 — `출발:`/`도착:`이 모두 있는 마지막 블록 우선 */
  const blocks = sectionClean
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean)
  let legLines = allLines
  for (let bi = blocks.length - 1; bi >= 0; bi--) {
    const bl = blocks[bi]!
      .split('\n')
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
    const hasOut = bl.some((l) => /^출발\s*[:：]/i.test(l))
    const hasIn = bl.some((l) => /^도착\s*[:：]/i.test(l))
    if (hasOut && hasIn) {
      legLines = bl
      break
    }
  }

  let airlineName: string | null = null
  let outLine: string | null = null
  let inLine: string | null = null
  for (const line of legLines) {
    if (/^출발\s*[:：]/i.test(line)) outLine = line
    else if (/^도착\s*[:：]/i.test(line)) inLine = line
  }

  const firstOutIdx = legLines.findIndex((l) => /^출발\s*[:：]/i.test(l))
  if (firstOutIdx > 0) {
    const prev = legLines[firstOutIdx - 1]!
    if (!isJunkHanatourAirlineLine(prev) && !/^도착\s*[:：]/i.test(prev)) {
      airlineName = prev.trim()
    }
  }
  if (!airlineName) {
    for (const line of legLines) {
      if (/^출발|^도착/i.test(line)) continue
      if (isJunkHanatourAirlineLine(line)) continue
      if (/항공|AIR|Air|airways|항공사/i.test(line)) {
        airlineName = line.trim()
        break
      }
    }
  }
  if (!airlineName && legLines.length > 0) {
    const first = legLines[0]!
    if (
      !/^출발|^도착/i.test(first) &&
      first.length < 48 &&
      !isJunkHanatourAirlineLine(first)
    ) {
      airlineName = first.trim()
    }
  }
  if (isJunkHanatourAirlineLine(airlineName)) airlineName = null

  const empty = createEmptyFlightLeg()
  const po = outLine ? parseHanatourLabeledLegLine(outLine, '출발') : null
  const pi = inLine ? parseHanatourLabeledLegLine(inLine, '도착') : null
  const outbound = mergeLeg(empty, po)
  const inbound = mergeLeg(empty, pi)

  const supplierBrandKey = 'hanatour'
  const expectFlightNumber = true
  const outCore = legCoreCount(outbound)
  const inCore = legCoreCount(inbound)
  const partialStructured = outCore >= 2 || inCore >= 2
  const successStructured = outCore >= 4 && inCore >= 4 && Boolean(outbound.flightNo && inbound.flightNo)
  const status: 'success' | 'partial' | 'failure' = successStructured
    ? 'success'
    : partialStructured
      ? 'partial'
      : 'failure'
  const exposurePolicy =
    status === 'success' ? 'public_full' : status === 'partial' ? 'public_limited' : 'admin_only'

  const reviewReasons: string[] = []
  if (!outLine || !inLine) reviewReasons.push('출발/도착 라벨 줄 분리 실패')
  if (expectFlightNumber && !outbound.flightNo && !inbound.flightNo) reviewReasons.push('편명 누락')
  if (status !== 'success') reviewReasons.push('하나투어 항공 구조화 미완 — 원문 검수')

  return {
    airlineName,
    outbound,
    inbound,
    rawFlightLines: [outLine, inLine].filter((x): x is string => Boolean(x)),
    debug: {
      candidateCount: Number(Boolean(outLine)) + Number(Boolean(inLine)),
      selectedOutRaw: outLine,
      selectedInRaw: inLine,
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
