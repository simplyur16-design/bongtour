import { formatDirectedFlightRow } from '@/lib/flight-user-display'
import type { FlightStructured } from '@/lib/detail-body-parser-types'

/**
 * 모두투어 본문 항공 블록 전용 결정적 파서.
 *
 * [고정] 모두투어(modetour) 본문 구조에만 맞춘 규칙이다. 다른 공급사 공통 로직으로 승격·재사용하지 말 것.
 * 호출부는 관리자 brandKey·등록 파서 debug 등으로 modetour로 확정된 경우에만 둔다. (본문만으로 공급사 추정 금지)
 *
 * 예:
 * 항공사: 중국남방항공
 * 출발 : 인천 2026.07.07(화) 19:20 → 연길 2026.07.07(화) 20:40 CZ6074
 * 도착 : 연길 2026.07.10(금) 10:10 → 인천 2026.07.10(금) 13:25 CZ6073
 */

export type ModetourFlightLeg = {
  departureAirport: string | null
  departureAirportCode: string | null
  departureDate: string | null
  departureTime: string | null
  arrivalAirport: string | null
  arrivalAirportCode: string | null
  arrivalDate: string | null
  arrivalTime: string | null
  flightNo: string | null
  durationText: string | null
}

export type ModetourFlightParseOk = {
  ok: true
  airlineName: string | null
  outLine: string
  inLine: string
  outbound: ModetourFlightLeg
  inbound: ModetourFlightLeg
}

export type ModetourFlightParseFail = {
  ok: false
  needsReview: true
  snippet: string
}

export type ModetourFlightParseResult = ModetourFlightParseOk | ModetourFlightParseFail

/** 등록 미리보기/API에서 실제 경로 증명용 (모두투어일 때만 채움) */
export type ModetourParseTrace = {
  parserInvoked: true
  inputLineCount: number
  airlineLineFound: boolean
  outboundLineRaw: string | null
  inboundLineRaw: string | null
  outboundBodyRegexOk: boolean
  inboundBodyRegexOk: boolean
  failStage: 'none' | 'missing_outbound_line' | 'missing_inbound_line' | 'regex_outbound_body' | 'regex_inbound_body'
  deterministicParserSucceeded: boolean
  usedFallbackGenericParser: boolean
}

/** IATA 스타일 편명: CZ6074 / LJ123 + 국내 LCC `7C5203`·`9C1234` 등 숫자+문자+숫자 */
const MODETOUR_FLIGHT_NO_TAIL =
  '(?:[A-Z]{1,3}\\d{2,5}|\\d[A-Z]\\d{3,4}|\\d{2}[A-Z]\\d{2,4})'

/** 라벨 제거 후 본문: 공항 날짜(요일) 시각 → 공항 날짜(요일) 시각 [편명 선택] — 실본문에서 → 외 화살표·편명 생략 케이스 허용 */
const MODETOUR_LEG_BODY_RE = new RegExp(
  '^(.+?)\\s+(\\d{4}[.\\-/]\\d{1,2}[.\\-/]\\d{1,2})(\\([^)]*\\))?\\s+((?:[01]?\\d|2[0-3]):[0-5]\\d)\\s*[→➝>＞]\\s*(.+?)\\s+(\\d{4}[.\\-/]\\d{1,2}[.\\-/]\\d{1,2})(\\([^)]*\\))?\\s+((?:[01]?\\d|2[0-3]):[0-5]\\d)(?:\\s+(' +
    MODETOUR_FLIGHT_NO_TAIL +
    '))?\\s*$',
  'iu'
)

function normalizeDetailDate(d: string): string {
  return d.replace(/\./g, '-').replace(/\//g, '-')
}

/** 한 줄에 `출발: … → …` 뒤에 `도착 : …` 귀국 일정이 이어지면 가는편 정규식이 마지막 시각·편명을 잡아 오염됨 */
function clipModetourOutboundBodyBeforeArrivalLabel(body: string): string {
  const t = body.trim()
  const idx = t.search(/\s도착\s*[:：]/i)
  if (idx <= 0) return t
  return t.slice(0, idx).trim()
}

function clipModetourInboundBodyBeforeDepartLabel(body: string): string {
  const t = body.trim()
  const idx = t.search(/\s출발\s*[:：]/i)
  if (idx <= 0) return t
  return t.slice(0, idx).trim()
}

function parseLegBody(body: string): ModetourFlightLeg | null {
  const m = body.trim().match(MODETOUR_LEG_BODY_RE)
  if (!m) return null
  return {
    departureAirport: m[1]!.trim(),
    departureAirportCode: null,
    departureDate: normalizeDetailDate(m[2]!),
    departureTime: m[4]!,
    arrivalAirport: m[5]!.trim(),
    arrivalAirportCode: null,
    arrivalDate: normalizeDetailDate(m[6]!),
    arrivalTime: m[8]!,
    flightNo: m[9] ? m[9].toUpperCase() : null,
    durationText: null,
  }
}

/**
 * 모두투어 붙여넣기 흔한 변형: `인천 → 연길 2026.04.20(월) 19:20 / CZ6074` — 구간당 날짜·시각 한 세트.
 * (엄격 패턴은 출발지·도착지 각각에 날짜가 있는 형태만 받는다.)
 */
const MODETOUR_LEG_BODY_LOOSE_RE = new RegExp(
  '^(.+?)\\s*[→➝>＞]\\s*(.+?)\\s+(\\d{4}[.\\-/]\\d{1,2}[.\\-/]\\d{1,2})(\\([^)]*\\))?\\s+((?:[01]?\\d|2[0-3]):[0-5]\\d)(?:\\s*[/／]\\s*|\\s+)(' +
    MODETOUR_FLIGHT_NO_TAIL +
    ')?\\s*$',
  'iu'
)

function parseLegBodyLoose(body: string): ModetourFlightLeg | null {
  const m = body.trim().match(MODETOUR_LEG_BODY_LOOSE_RE)
  if (!m) return null
  const depA = m[1]!.trim()
  const arrA = m[2]!.trim()
  const d = normalizeDetailDate(m[3]!)
  const tm = m[5]!
  const fn = m[6] ? m[6].toUpperCase() : null
  return {
    departureAirport: depA,
    departureAirportCode: null,
    departureDate: d,
    departureTime: tm,
    arrivalAirport: arrA,
    arrivalAirportCode: null,
    arrivalDate: d,
    arrivalTime: tm,
    flightNo: fn,
    durationText: null,
  }
}

function parseLegBodyFlexible(body: string): ModetourFlightLeg | null {
  return parseLegBody(body) ?? parseLegBodyLoose(body)
}

/** 긴/구체 패턴 우선 — 편명·코드 결합·영문 약칭 */
const MODETOUR_AIRLINE_LOOSE_PATTERNS: Array<{ re: RegExp; name: string }> = [
  { re: /아시아나(?:항공)?(?:\s+OZ|\bOZ[-\s]?\d)/i, name: '아시아나항공' },
  { re: /대한항공(?:\s+KE|\bKE[-\s]?\d)/i, name: '대한항공' },
  { re: /티웨이(?:항공)?(?:\s+TW|\bTW[-\s]?\d)/i, name: '티웨이항공' },
  { re: /에어(?:부산|프레미아)|에어부산(?:\s+BX|\bBX[-\s]?\d)?/i, name: '에어부산' },
  { re: /이스타(?:항공)?(?:\s+ZE|\bZE[-\s]?\d)?/i, name: '이스타항공' },
  { re: /에어서울(?:\s+RS|\bRS[-\s]?\d)?/i, name: '에어서울' },
  { re: /제주항공(?:\s+7C|\b7C\d)/i, name: '제주항공' },
  { re: /진에어(?:\s+LJ|\bLJ[-\s]?\d)/i, name: '진에어' },
  { re: /(?:\bANA\b|전일본(?:항공)?|올\s*닛폰)/i, name: 'ANA' },
  { re: /(?:\bJAL\b|일본항공)/i, name: 'JAL' },
  { re: /\bUA\d/i, name: 'United Airlines' },
  { re: /\bDL\d/i, name: 'Delta Air Lines' },
  { re: /\bAA\d/i, name: 'American Airlines' },
  { re: /중국남방항공|\bCZ\d/i, name: '중국남방항공' },
  { re: /중국국제항공|\bCA\d/i, name: '중국국제항공' },
  { re: /아시아나(?:항공)?/i, name: '아시아나항공' },
  { re: /대한항공/i, name: '대한항공' },
  { re: /티웨이(?:항공)?/i, name: '티웨이항공' },
  { re: /제주항공/i, name: '제주항공' },
  { re: /진에어/i, name: '진에어' },
  { re: /에어부산/i, name: '에어부산' },
  { re: /이스타(?:항공)?/i, name: '이스타항공' },
]

export function extractModetourAirlineMatch(
  haystack: string | null | undefined
): { normalized: string; raw: string } | null {
  if (!haystack?.trim()) return null
  const t = haystack.replace(/\s+/g, ' ')
  for (const { re, name } of MODETOUR_AIRLINE_LOOSE_PATTERNS) {
    const m = t.match(re)
    if (m?.[0]?.trim()) return { normalized: name, raw: m[0].trim() }
  }
  return null
}

export function extractModetourAirlineNameLoose(haystack: string | null | undefined): string | null {
  return extractModetourAirlineMatch(haystack)?.normalized ?? null
}

/**
 * @param lines stripLogoNoise·cleanLine 적용된 비어 있지 않은 줄 배열
 */
export function tryParseModetourFlightLines(
  lines: string[],
  sectionSnippet: string
): { result: ModetourFlightParseResult; trace: ModetourParseTrace } {
  const airlineLine = lines.find((l) => /^항공사\s*[:：]/i.test(l))
  let airlineName = airlineLine
    ? airlineLine
        .replace(/^항공사\s*[:：]\s*/i, '')
        .replace(/\blogo-\S+/gi, '')
        .trim() || null
    : null

  /** 일정·미팅의 "출발: 08:00" 등 오탐 방지 — 날짜 + (화살표 또는 가는편/오는편 블록) */
  const isModetourScheduleLegLine = (line: string, kind: 'out' | 'in'): boolean => {
    const hasTag =
      kind === 'out'
        ? /(?:출발|출국|가는\s*편)\s*[:：]?/i.test(line)
        : /(?:도착|귀국|오는\s*편|입국)\s*[:：]?/i.test(line)
    if (!hasTag) return false
    if (!/\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}/.test(line)) return false
    return /[→➝>＞]/.test(line) || /가는\s*편|오는\s*편/i.test(line)
  }

  const outCandidates = lines.filter((l) => isModetourScheduleLegLine(l, 'out'))
  const inCandidates = lines.filter((l) => isModetourScheduleLegLine(l, 'in'))

  let outLine: string | null = null
  let inLine: string | null = null
  outer: for (const o of outCandidates) {
    const ob = clipModetourOutboundBodyBeforeArrivalLabel(
      o.replace(/^.*?(?:출발|출국|가는\s*편)\s*[:：]?\s*/i, '').trim()
    )
    if (!parseLegBodyFlexible(ob)) continue
    for (const i of inCandidates) {
      const ib = clipModetourInboundBodyBeforeDepartLabel(
        i.replace(/^.*?(?:도착|귀국|오는\s*편|입국)\s*[:：]?\s*/i, '').trim()
      )
      if (parseLegBodyFlexible(ib)) {
        outLine = o
        inLine = i
        break outer
      }
    }
  }

  if (!airlineName) {
    const standalone = lines.find(
      (l) =>
        l.trim().length > 1 &&
        l.trim().length < 48 &&
        /항공/.test(l) &&
        !/출발|도착|[→➝>＞]/.test(l) &&
        !/logo-/i.test(l)
    )
    if (standalone) airlineName = standalone.replace(/\s+/g, ' ').trim() || null
  }

  const baseTrace = (over: Partial<ModetourParseTrace>): ModetourParseTrace => ({
    parserInvoked: true,
    inputLineCount: lines.length,
    airlineLineFound: Boolean(airlineLine),
    outboundLineRaw: outLine,
    inboundLineRaw: inLine,
    outboundBodyRegexOk: false,
    inboundBodyRegexOk: false,
    failStage: 'none',
    deterministicParserSucceeded: false,
    usedFallbackGenericParser: false,
    ...over,
  })

  if (!outLine || !inLine) {
    return {
      result: {
        ok: false,
        needsReview: true,
        snippet: sectionSnippet.slice(0, 800),
      },
      trace: baseTrace({
        failStage: !outLine ? 'missing_outbound_line' : 'missing_inbound_line',
      }),
    }
  }

  const outBody = clipModetourOutboundBodyBeforeArrivalLabel(
    outLine.replace(/^.*?(?:출발|출국|가는\s*편)\s*[:：]?\s*/i, '').trim()
  )
  const inBody = clipModetourInboundBodyBeforeDepartLabel(
    inLine.replace(/^.*?(?:도착|귀국|오는\s*편|입국)\s*[:：]?\s*/i, '').trim()
  )

  const outbound = parseLegBodyFlexible(outBody)
  const inbound = parseLegBodyFlexible(inBody)

  if (!outbound || !inbound) {
    return {
      result: {
        ok: false,
        needsReview: true,
        snippet: [outLine, inLine].join('\n').slice(0, 800),
      },
      trace: baseTrace({
        outboundBodyRegexOk: Boolean(outbound),
        inboundBodyRegexOk: Boolean(inbound),
        failStage: !outbound ? 'regex_outbound_body' : 'regex_inbound_body',
      }),
    }
  }

  if (!airlineName?.trim()) {
    airlineName = extractModetourAirlineNameLoose(sectionSnippet) ?? airlineName
  }

  return {
    result: {
      ok: true,
      airlineName,
      outLine,
      inLine,
      outbound,
      inbound,
    },
    trace: baseTrace({
      outboundBodyRegexOk: true,
      inboundBodyRegexOk: true,
      failStage: 'none',
      deterministicParserSucceeded: true,
    }),
  }
}

function stripLogoNoiseForModetour(s: string): string {
  return s
    .replace(/\blogo-[a-z0-9_-]+\b/gi, ' ')
    .replace(/[：﹕]/g, ':')
    .replace(/\s+/g, ' ')
    .trim()
}

function combineFlightDateTimeForDisplay(
  d: string | null | undefined,
  t: string | null | undefined
): string | null {
  const dd = (d ?? '').replace(/-/g, '.').trim()
  const tt = (t ?? '').trim()
  if (dd && tt) return `${dd} ${tt}`
  return dd || tt || null
}

export type ModetourDirectedDisplay = {
  departureLine: string | null
  returnLine: string | null
  airlineName: string | null
}

/** `departure-key-facts` 병합용 — 공항·출도착 일시·편명(결정적 파싱) */
export type ModetourDepartureLegCard = {
  departureAirport: string | null
  arrivalAirport: string | null
  departureAtText: string | null
  arrivalAtText: string | null
  flightNo: string | null
}

type ModetourResolved = {
  ob: ModetourFlightLeg
  ib: ModetourFlightLeg
  airlineName: string | null
  raw: string
}

function tryModetourResolvedParse(flightRaw: string | null | undefined): ModetourResolved | null {
  const raw = (flightRaw ?? '').trim()
  if (!raw) return null
  const lines = stripLogoNoiseForModetour(raw)
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const { result, trace } = tryParseModetourFlightLines(lines, raw)
  if (!result.ok || !trace.deterministicParserSucceeded) return null
  const ob = result.outbound
  const ib = result.inbound
  let airlineName = result.airlineName ?? null
  if (!airlineName?.trim()) {
    airlineName = extractModetourAirlineNameLoose(raw)
  }
  return { ob, ib, airlineName, raw }
}

function modetourLegToDisplayCard(leg: ModetourFlightLeg): ModetourDepartureLegCard {
  return {
    departureAirport: leg.departureAirport,
    arrivalAirport: leg.arrivalAirport,
    departureAtText: combineFlightDateTimeForDisplay(leg.departureDate, leg.departureTime),
    arrivalAtText: combineFlightDateTimeForDisplay(leg.arrivalDate, leg.arrivalTime),
    flightNo: leg.flightNo,
  }
}

/**
 * 공개 상세 `TravelCoreInfoSection`용 leg 카드 — extract 병합보다 우선해 출·도착 일시 4슬롯을 채운다.
 */
export function tryModetourDepartureLegCardsFromStructuredBody(
  flightRaw: string | null | undefined,
  detailBodyNormalizedRaw: string | null | undefined
): { outbound: ModetourDepartureLegCard; inbound: ModetourDepartureLegCard } | null {
  /** directed 표시(`buildModetourDirectedDisplayFromStructuredBody`)와 동일 우선순위 — 본문 전체를 머지하면 잘못된 출발/도착 줄 쌍을 고를 수 있음 */
  const r = tryModetourResolvedParse(flightRaw) ?? tryModetourResolvedParse(detailBodyNormalizedRaw)
  if (!r) return null
  return { outbound: modetourLegToDisplayCard(r.ob), inbound: modetourLegToDisplayCard(r.ib) }
}

function computeModetourDirectedFromRaw(flightRaw: string | null | undefined): ModetourDirectedDisplay | null {
  const r = tryModetourResolvedParse(flightRaw)
  if (!r) return null
  const { ob, ib, airlineName } = r
  const departureLine = formatDirectedFlightRow('가는편', {
    departureAirport: ob.departureAirport,
    arrivalAirport: ob.arrivalAirport,
    departureAtText: combineFlightDateTimeForDisplay(ob.departureDate, ob.departureTime),
    arrivalAtText: combineFlightDateTimeForDisplay(ob.arrivalDate, ob.arrivalTime),
    flightNo: ob.flightNo,
  }).line
  const returnLine = formatDirectedFlightRow('오는편', {
    departureAirport: ib.departureAirport,
    arrivalAirport: ib.arrivalAirport,
    departureAtText: combineFlightDateTimeForDisplay(ib.departureDate, ib.departureTime),
    arrivalAtText: combineFlightDateTimeForDisplay(ib.arrivalDate, ib.arrivalTime),
    flightNo: ib.flightNo,
  }).line
  if (!departureLine?.trim() || !returnLine?.trim()) return null
  /** 한 줄에 가는편+도착 라벨이 붙은 경우 가는편 카드용으로 도착 이후 절단 */
  let depLine = departureLine
  if (/도착\s*[:：]/.test(depLine)) {
    const cut = depLine.split(/도착\s*[:：]/)[0]?.trim()
    if (cut && cut.length >= 12) depLine = cut
  }
  return { departureLine: depLine, returnLine, airlineName }
}

/**
 * `rawMeta.structuredSignals.flightRaw` 등 저장된 항공 원문에서만 결정적 파싱 성공 시
 * 가는편/오는편 표시용 한 줄을 만든다. (brandKey=modetour일 때만 호출할 것)
 */
export function buildModetourDirectedSegmentLinesFromFlightRaw(
  flightRaw: string | null | undefined
): { departureLine: string | null; returnLine: string | null } | null {
  const d = computeModetourDirectedFromRaw(flightRaw)
  return d ? { departureLine: d.departureLine, returnLine: d.returnLine } : null
}

/**
 * 공개 상세·재검증: `flightRaw`만으로 directed 실패 시 `detailBodyNormalizedRaw`(등록 시 본문 전체)로 재시도.
 * `register-parse`의 `expandModetourFlightRawForDirectedParse` 와 동일 우선순위.
 */
export function buildModetourDirectedSegmentLinesFromStructuredBody(
  flightRaw: string | null | undefined,
  detailBodyNormalizedRaw: string | null | undefined
): { departureLine: string | null; returnLine: string | null } | null {
  const d = buildModetourDirectedDisplayFromStructuredBody(flightRaw, detailBodyNormalizedRaw)
  return d ? { departureLine: d.departureLine, returnLine: d.returnLine } : null
}

/** 항공사명까지 포함 — 공개 상세 `flightStructured` 보강용 */
export function buildModetourDirectedDisplayFromStructuredBody(
  flightRaw: string | null | undefined,
  detailBodyNormalizedRaw: string | null | undefined
): ModetourDirectedDisplay | null {
  return computeModetourDirectedFromRaw(flightRaw) ?? computeModetourDirectedFromRaw(detailBodyNormalizedRaw)
}

function modetourStructuredLegToParserLeg(leg: FlightStructured['outbound']): ModetourFlightLeg {
  return {
    departureAirport: leg.departureAirport,
    departureAirportCode: leg.departureAirportCode,
    departureDate: leg.departureDate,
    departureTime: leg.departureTime,
    arrivalAirport: leg.arrivalAirport,
    arrivalAirportCode: leg.arrivalAirportCode,
    arrivalDate: leg.arrivalDate,
    arrivalTime: leg.arrivalTime,
    flightNo: leg.flightNo,
    durationText: leg.durationText,
  }
}

function modetourLegCardHasContent(c: ModetourDepartureLegCard): boolean {
  return Boolean(
    (c.departureAirport ?? '').trim() ||
      (c.arrivalAirport ?? '').trim() ||
      (c.departureAtText ?? '').trim() ||
      (c.arrivalAtText ?? '').trim() ||
      (c.flightNo ?? '').trim()
  )
}

/**
 * 등록 시 저장된 `flightStructured.outbound/inbound` — 원문 재파싱이 실패해도 공항·일시·편명을 살린다.
 * (모두투어 brand/debug 확정 시에만 호출)
 */
export function tryModetourDepartureLegCardsFromFlightStructured(
  fs: FlightStructured | null | undefined
): { outbound: ModetourDepartureLegCard; inbound: ModetourDepartureLegCard } | null {
  if (!fs?.outbound || !fs?.inbound) return null
  const ob = modetourLegToDisplayCard(modetourStructuredLegToParserLeg(fs.outbound))
  const ib = modetourLegToDisplayCard(modetourStructuredLegToParserLeg(fs.inbound))
  if (!modetourLegCardHasContent(ob) && !modetourLegCardHasContent(ib)) return null
  return { outbound: ob, inbound: ib }
}

/** 원문 directed 파싱 실패 시 structured leg 로 가는/오는 편 한 줄 생성 */
export function buildModetourDirectedDisplayFromFlightStructured(
  fs: FlightStructured | null | undefined
): ModetourDirectedDisplay | null {
  if (!fs?.outbound || !fs?.inbound) return null
  const ob = modetourStructuredLegToParserLeg(fs.outbound)
  const ib = modetourStructuredLegToParserLeg(fs.inbound)
  const airlineName = fs.airlineName?.trim() || null
  const departureLine = formatDirectedFlightRow('가는편', {
    departureAirport: ob.departureAirport,
    arrivalAirport: ob.arrivalAirport,
    departureAtText: combineFlightDateTimeForDisplay(ob.departureDate, ob.departureTime),
    arrivalAtText: combineFlightDateTimeForDisplay(ob.arrivalDate, ob.arrivalTime),
    flightNo: ob.flightNo,
  }).line
  const returnLine = formatDirectedFlightRow('오는편', {
    departureAirport: ib.departureAirport,
    arrivalAirport: ib.arrivalAirport,
    departureAtText: combineFlightDateTimeForDisplay(ib.departureDate, ib.departureTime),
    arrivalAtText: combineFlightDateTimeForDisplay(ib.arrivalDate, ib.arrivalTime),
    flightNo: ib.flightNo,
  }).line
  if (!departureLine?.trim() || !returnLine?.trim()) return null
  let depLine = departureLine
  if (/도착\s*[:：]/.test(depLine)) {
    const cut = depLine.split(/도착\s*[:：]/)[0]?.trim()
    if (cut && cut.length >= 12) depLine = cut
  }
  return { departureLine: depLine, returnLine, airlineName }
}
