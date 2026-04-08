import type { FlightStructured } from '@/lib/detail-body-parser-types'
import type { PreferredFlightLegs } from '@/lib/flight-preferred-legs-types'

type FlightLeg = FlightStructured['outbound']

/** 등록용 공급사 전용 파서가 `FlightStructured` 껍데기를 채울 때 공통 사용(의미 해석 없음). */
export function createEmptyFlightLeg(): FlightLeg {
  return {
    departureAirport: null,
    departureAirportCode: null,
    departureDate: null,
    departureTime: null,
    arrivalAirport: null,
    arrivalAirportCode: null,
    arrivalDate: null,
    arrivalTime: null,
    flightNo: null,
    durationText: null,
  }
}

const KOREA_LOCATIONS = ['인천', '김포', '부산', '제주', '청주', '대구', '서울', 'ICN', 'GMP', 'PUS', 'CJU']
const FLIGHT_NARRATIVE_BANNED = /(유의사항|참고사항|예약\s*시|집합시간|미팅|관광|식사|숙박|쇼핑|포함사항|불포함사항|환불규정|장문)/i

export function stripLogoNoise(s: string): string {
  return s
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\blogo-[a-z0-9_-]+\b/gi, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

function cleanLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim()
}

function parseDateTimeTokens(line: string): { date: string | null; time: string | null } {
  const d = line.match(/(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}|\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2})/)
  const t =
    line.match(/\)\s*([0-2]?\d:[0-5]\d)/)?.[1] ??
    line.match(/(?:^|[\s，,])([0-2]?\d:[0-5]\d)/)?.[1] ??
    line.match(/([0-2]?\d:[0-5]\d)/)?.[1] ??
    null
  const date = d?.[1] ? d[1].replace(/[.]/g, '-').replace(/^\d{2}-/, '20') : null
  return { date, time: t }
}

function extractDurationText(m: string): string | null {
  const x = stripLogoNoise(m)
  const d =
    x.match(
      /(\d+\s*시간\s*\d+\s*분\s*소요|\d+\s*시간\s*(?:\d+\s*분\s*)?소요|\d+\s*분\s*소요|약\s*\d+\s*시간\s*\d+\s*분|약\s*\d+\s*시간)/i
    )?.[1] ?? null
  return d?.trim() ?? null
}

function isKoreaLocationToken(v: string | null | undefined): boolean {
  if (!v) return false
  const t = v.toUpperCase()
  return KOREA_LOCATIONS.some((k) => t.includes(k.toUpperCase()))
}

function buildFlightCandidateBlocks(lines: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    for (const w of [2, 3, 4, 5, 6, 7, 8]) {
      const slice = lines.slice(i, i + w)
      if (slice.length < 2) continue
      const block = slice.join(' | ')
      const hasAirportCode = /\b([A-Z]{3})\b/.test(block)
      const hasDirectionWord = /(출발|도착|출국|입국|가는편|오는편)/.test(block)
      const hasCityIata = /([가-힣A-Za-z]{2,20})\s*\(([A-Z]{3})\)\s*(출발|도착|출국|입국)/.test(block)
      const score =
        Number(/([가-힣A-Za-z]{2,20}|[A-Z]{3})\s*(?:공항)?\s*(?:→|->)\s*([가-힣A-Za-z]{2,20}|[A-Z]{3})/.test(block)) +
        Number(/(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}|\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2})/.test(block)) +
        Number(/([0-2]?\d:[0-5]\d)/.test(block)) +
        Number(/([A-Z]{1,3}\d{2,5})/.test(block)) +
        Number(/(항공사|항공|AIR|대한항공|아시아나|제주항공|진에어|중국남방|하문항공|ANA|JAL)/i.test(block)) +
        Number(hasAirportCode) +
        Number(hasDirectionWord) +
        Number(hasCityIata) * 2 +
        Number(/(?:시간|분).*소요|소요\s*시간/i.test(block))
      if (score >= 3) out.push(block)
    }
  }
  return Array.from(new Set(out))
}

/** 일정 본문 2차 스캔 — 전용 항공 엔트리에서도 동일 후보 생성 시 사용 */
export function buildSecondaryFlightBlocks(fullBody: string): string[] {
  const lines = stripLogoNoise(fullBody)
    .split('\n')
    .map(cleanLine)
    .filter(Boolean)
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    for (let w = 4; w <= 8; w++) {
      const slice = lines.slice(i, i + w)
      if (slice.length < 4) continue
      const block = slice.join(' | ')
      let score = 0
      if (/([가-힣A-Za-z]{2,20})\s*\(([A-Z]{3})\)\s*(출발|도착|출국|입국)/.test(block)) score += 5
      if (/\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}/.test(block)) score += 2
      if (/[0-2]?\d:[0-5]\d/.test(block)) score += 2
      if (/(?:\d+\s*시간|\d+\s*분).*소요|소요\s*시간|약\s*\d+\s*시간/i.test(block)) score += 2
      if (
        /(항공사|대한항공|아시아나|제주항공|진에어|중국남방|하문항공|에어부산|이스타|티웨이|에어서울|ANA|JAL|루프트한자|AIR\s*CHINA|CHINA\s*SOUTHERN)/i.test(
          block
        )
      )
        score += 2
      if (/(가는편|오는편|출국편|귀국편|항공편)/.test(block)) score += 2
      if (/\b[A-Z]{3}\b/.test(block)) score += 1
      if (FLIGHT_NARRATIVE_BANNED.test(block) && score < 6) score -= 3
      if (score >= 5) out.push(block)
    }
  }
  return Array.from(new Set(out))
}

function hasHardFlightEvidence(c: string): boolean {
  return (
    /([A-Z]{1,3}\d{2,5})/.test(c) ||
    /([가-힣A-Za-z]{2,20}|[A-Z]{3})\s*(?:공항)?\s*(?:→|->)\s*([가-힣A-Za-z]{2,20}|[A-Z]{3})/.test(c) ||
    /\b([A-Z]{3})\b.*?(?:→|->|\s)\s*\b([A-Z]{3})\b/.test(c) ||
    /([가-힣A-Za-z]{2,20})\s*\(([A-Z]{3})\)\s*(출발|도착|출국|입국)/.test(c) ||
    /(항공사|항공|AIR|대한항공|아시아나|제주항공|진에어|중국남방|하문항공|ANA|JAL|루프트한자|CHINA\s*SOUTHERN)/i.test(c)
  )
}

export type ParseFlightSectionGenericOptions = {
  expectFlightNumber: boolean
  /** 디버그·노출용 라벨(본문으로 공급사 추정하지 않음) */
  supplierBrandKey: string | null
  /** 전용 결정적 파서 실패 후 제네릭으로 넘어온 경우 관리자용 안내(공급사 모듈에서만 문구 설정) */
  genericFlightFallbackNote?: string | null
  modetourParseTrace?: import('@/lib/flight-modetour-parser').ModetourParseTrace
  preferredFlightLegsOverride?: PreferredFlightLegs | null
  /** 가는/오는 편 1차 구조화 직후 공급사 전용 보정(예: 파이프 결합 줄) */
  refineParsedLegs?: (ctx: {
    outRaw: string | null
    inRaw: string | null
    outLeg: FlightLeg
    inLeg: FlightLeg
  }) => { outbound: FlightLeg; inbound: FlightLeg } | null
}

/**
 * 항공 본문 발췌 — 공급사 결정적 파서 없음. 모두투어/참좋은 전용 엔트리는 각각 `flight-parser-modetour` 등.
 */
export function parseFlightSectionGeneric(
  section: string,
  fullBodyForSecondary: string | null | undefined,
  options: ParseFlightSectionGenericOptions
): FlightStructured {
  const sectionClean = stripLogoNoise(section)
  const lines = sectionClean.split('\n').map(cleanLine).filter(Boolean)
  const {
    expectFlightNumber,
    supplierBrandKey,
    genericFlightFallbackNote = null,
    modetourParseTrace,
    preferredFlightLegsOverride = null,
    refineParsedLegs,
  } = options

  const secondaryBlocks =
    fullBodyForSecondary && fullBodyForSecondary.trim().length > 0
      ? buildSecondaryFlightBlocks(stripLogoNoise(fullBodyForSecondary))
      : []

  const airlineLine =
    lines.find((l) => /(항공사|AIR|항공)/i.test(l) && !/logo-/i.test(l)) ??
    secondaryBlocks
      .flatMap((b) => b.split(/\s*\|\s*/))
      .find((l) => /(항공사|AIR|항공)/i.test(l) && !/logo-/i.test(l)) ??
    null

  const flightLineRe = /(가는편|오는편|출국편|귀국편|입국편|출국|입국|항공편|출발|도착|→|[A-Z]{1,3}\d{2,5})/i
  const rawCandidates = Array.from(
    new Set([
      ...lines.filter((l) => flightLineRe.test(l)),
      ...buildFlightCandidateBlocks(lines),
      ...secondaryBlocks,
    ])
  )

  const candidates = rawCandidates.filter((c) => {
    const hardEvidence = hasHardFlightEvidence(c)
    const weakDateTimeOnly =
      !hardEvidence &&
      /([0-2]?\d:[0-5]\d|\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}|\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2})/.test(c)
    if (FLIGHT_NARRATIVE_BANNED.test(c) && !hardEvidence) return false
    if (weakDateTimeOnly) return false
    return true
  })

  const airportRe = /([가-힣A-Za-z]{2,20}|[A-Z]{3})\s*(?:공항)?\s*(?:→|->)\s*([가-힣A-Za-z]{2,20}|[A-Z]{3})/
  const airportCodePairRe = /\b([A-Z]{3})\b.*?(?:→|->|\s)\s*\b([A-Z]{3})\b/
  const fnRe = /([A-Z]{1,3}\d{2,5})/
  const scheduleDates = lines
    .map((l) => parseDateTimeTokens(l).date)
    .filter((x): x is string => !!x)
    .sort((a, b) => String(a).localeCompare(String(b)))

  const parseLeg = (raw: string | null): FlightLeg => {
    const m = stripLogoNoise(raw ?? '')
    const r = m.match(airportRe)
    const rc = m.match(airportCodePairRe)
    const f = m.match(fnRe)
    const dt = parseDateTimeTokens(m)
    const fallbackDate = scheduleDates.length > 0 ? scheduleDates[0] : null
    const depSingle =
      /(출발|출국)\s*[:：]?\s*(?!전까지\b|직전\b|당일\b)([가-힣A-Za-z]{2,20}|[A-Z]{3})\b/.exec(m)?.[2] ?? null
    const arrSingle =
      /(도착|입국|귀국)\s*[:：]?\s*(?!전까지\b)([가-힣A-Za-z]{2,20}|[A-Z]{3})\b/.exec(m)?.[2] ?? null

    let departureAirport = r?.[1] ?? rc?.[1] ?? depSingle
    let departureAirportCode: string | null = null
    let arrivalAirport = r?.[2] ?? rc?.[2] ?? arrSingle
    let arrivalAirportCode: string | null = null

    const outCity = /([가-힣A-Za-z]{2,20})\s*\(([A-Z]{3})\)\s*(출발|출국)/.exec(m)
    if (outCity) {
      departureAirport = outCity[1]?.trim() ?? departureAirport
      departureAirportCode = outCity[2] ?? departureAirportCode
    }
    const inCity = /([가-힣A-Za-z]{2,20})\s*\(([A-Z]{3})\)\s*(도착|입국|귀국)/.exec(m)
    if (inCity) {
      arrivalAirport = inCity[1]?.trim() ?? arrivalAirport
      arrivalAirportCode = inCity[2] ?? arrivalAirportCode
    }

    const durationText = extractDurationText(m)

    return {
      departureAirport,
      departureAirportCode,
      departureDate: dt.date ?? fallbackDate,
      departureTime: dt.time,
      arrivalAirport,
      arrivalAirportCode,
      arrivalDate: dt.date ?? fallbackDate,
      arrivalTime: null,
      flightNo: f?.[1] ?? null,
      durationText,
    }
  }

  const scoreCandidate = (line: string): number => {
    const leg = parseLeg(line)
    const hasOutWord = /(가는편|출국편|출국|출발)/i.test(line)
    const hasInWord = /(오는편|귀국편|입국편|입국|도착)/i.test(line)
    return (
      Number(hasOutWord || hasInWord) +
      Number(!!leg.departureAirport || !!leg.arrivalAirport) +
      Number(!!leg.departureDate || !!leg.departureTime) +
      Number(!!leg.flightNo) +
      Number(!!leg.departureAirportCode || !!leg.arrivalAirportCode) +
      Number(!!leg.durationText) +
      Number(/(항공사|항공|AIR)/i.test(line))
    )
  }

  const sortedCandidates = candidates
    .map((line) => ({ line, score: scoreCandidate(line), date: parseDateTimeTokens(line).date }))
    .sort((a, b) => b.score - a.score || String(a.date ?? '').localeCompare(String(b.date ?? '')))

  const preferred = preferredFlightLegsOverride

  const explicitOut = sortedCandidates.find((x) => /(가는편|출국편|출국|출발)/i.test(x.line))?.line ?? null
  const explicitIn = sortedCandidates.find((x) => /(오는편|귀국편|입국편|입국|도착)/i.test(x.line))?.line ?? null
  let outRaw = explicitOut
  let inRaw = explicitIn
  if (!outRaw || !inRaw) {
    const dated = sortedCandidates.filter((x) => x.date)
    if (!outRaw && dated.length > 0) outRaw = dated[0]!.line
    if (!inRaw && dated.length > 1) inRaw = dated[dated.length - 1]!.line
  }
  if (!outRaw && sortedCandidates.length > 0) outRaw = sortedCandidates[0]!.line
  if (!inRaw && sortedCandidates.length > 1) inRaw = sortedCandidates[1]!.line
  if (!inRaw && sortedCandidates.length === 1) inRaw = sortedCandidates[0]!.line

  if (preferred?.outRaw && preferred?.inRaw) {
    outRaw = preferred.outRaw
    inRaw = preferred.inRaw
  }

  let outLeg = parseLeg(outRaw)
  let inLeg = parseLeg(inRaw)
  if (refineParsedLegs) {
    const refined = refineParsedLegs({ outRaw, inRaw, outLeg, inLeg })
    if (refined) {
      outLeg = refined.outbound
      inLeg = refined.inbound
    }
  }

  const likelyOutIsKoreaDepart = isKoreaLocationToken(outLeg.departureAirport)
  const likelyInIsKoreaArrive = isKoreaLocationToken(inLeg.arrivalAirport)
  if (!likelyOutIsKoreaDepart && !likelyInIsKoreaArrive) {
    const swappedOutK = isKoreaLocationToken(outLeg.arrivalAirport)
    const swappedInK = isKoreaLocationToken(inLeg.departureAirport)
    if (swappedOutK && swappedInK) {
      const o = { ...outLeg }
      outLeg.departureAirport = inLeg.departureAirport
      outLeg.arrivalAirport = inLeg.arrivalAirport
      outLeg.departureDate = inLeg.departureDate
      outLeg.departureTime = inLeg.departureTime
      outLeg.flightNo = inLeg.flightNo
      outLeg.departureAirportCode = inLeg.departureAirportCode
      outLeg.arrivalAirportCode = inLeg.arrivalAirportCode
      inLeg.departureAirport = o.departureAirport
      inLeg.arrivalAirport = o.arrivalAirport
      inLeg.departureDate = o.departureDate
      inLeg.departureTime = o.departureTime
      inLeg.flightNo = o.flightNo
      inLeg.departureAirportCode = o.departureAirportCode
      inLeg.arrivalAirportCode = o.arrivalAirportCode
    }
  }

  const reviewReasons: string[] = []
  if (genericFlightFallbackNote) {
    reviewReasons.push(genericFlightFallbackNote)
  }
  if (!outRaw || !inRaw) {
    if (outRaw || inRaw) reviewReasons.push('가는편/오는편 부분 분리')
    else reviewReasons.push('가는편/오는편 분리 실패')
  }
  const outCore = [
    outLeg.departureAirport,
    outLeg.arrivalAirport,
    outLeg.departureDate,
    outLeg.departureTime,
    outLeg.flightNo,
    outLeg.departureAirportCode,
    outLeg.arrivalAirportCode,
    outLeg.durationText,
  ].filter(Boolean).length
  const inCore = [
    inLeg.departureAirport,
    inLeg.arrivalAirport,
    inLeg.departureDate,
    inLeg.departureTime,
    inLeg.flightNo,
    inLeg.departureAirportCode,
    inLeg.arrivalAirportCode,
    inLeg.durationText,
  ].filter(Boolean).length
  const partialStructured = outCore >= 2 || inCore >= 2
  const successStructured = outCore >= 3 && inCore >= 3
  const status: 'success' | 'partial' | 'failure' = successStructured ? 'success' : partialStructured ? 'partial' : 'failure'
  const exposurePolicy: 'public_full' | 'public_limited' | 'admin_only' =
    status === 'success' ? 'public_full' : status === 'partial' ? 'public_limited' : 'admin_only'
  if (expectFlightNumber && !outLeg.flightNo && !inLeg.flightNo) reviewReasons.push('편명 누락')
  if (partialStructured && reviewReasons.some((x) => /분리 실패/.test(x))) {
    reviewReasons.push('부분 구조화로 유지')
  }

  const secondarySnippet =
    status === 'failure' && secondaryBlocks.length > 0
      ? secondaryBlocks.slice(0, 2).join('\n---\n').slice(0, 4000)
      : secondaryBlocks.length > 0
        ? secondaryBlocks[0]!.slice(0, 1200)
        : null

  const rawFlightLines = [
    ...candidates.slice(0, 12),
    ...(status === 'failure' && secondarySnippet ? [`[secondary_scan]\n${secondarySnippet}`] : []),
  ]

  return {
    airlineName: airlineLine ? airlineLine.replace(/.*항공사[:：]?\s*/i, '').replace(/\blogo-\S+/gi, '').trim() : null,
    outbound: outLeg,
    inbound: inLeg,
    rawFlightLines,
    debug: {
      candidateCount: candidates.length,
      selectedOutRaw: outRaw,
      selectedInRaw: inRaw,
      partialStructured,
      status,
      exposurePolicy,
      secondaryScanBlockCount: secondaryBlocks.length,
      secondaryFlightSnippet: secondarySnippet,
      supplierBrandKey: supplierBrandKey ?? undefined,
      expectFlightNumber,
      modetourParseTrace,
    },
    reviewNeeded: status === 'failure',
    reviewReasons,
  }
}
