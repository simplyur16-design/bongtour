/**
 * 롯데관광 정형 항공: `출발`/`도착` 블록 + 항공사 중복·편명·도시·일시.
 *
 * 붙여넣기 예:
 *   출발 / 항공사(중복 가능) / SK988 / 인천 / 2026.07.15 (수) 23:45 / 로마 / 2026.07.16 (목) 11:05
 *   도착 / … / SK987 / 파리 / … / 인천 / …
 */
import { stripLogoNoise } from '@/lib/flight-parser-generic'
import type { FlightStructured } from '@/lib/detail-body-parser-types'

type FlightLeg = FlightStructured['outbound']

/** 날짜 + 선택 요일 괄호 + 시각(00~23시) */
const LT_DT =
  /(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})\s*(?:\(([^)]*)\))?\s*((?:[01]?\d|2[0-3]):[0-5]\d)/

function normYbDate(d: string): string {
  const s = d.replace(/[.]/g, '-').trim()
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) {
    return `${m[1]}-${m[2]!.padStart(2, '0')}-${m[3]!.padStart(2, '0')}`
  }
  return s.replace(/^\d{2}-/, '20')
}

/** `2026-07-15 (수)` — combineFlightDateTime에서 `.` 치환 후 요일 유지 */
function ybDepartureOrArrivalDateField(datePart: string, weekdayRaw: string | undefined): string {
  const iso = normYbDate(datePart)
  const wk = (weekdayRaw ?? '').replace(/\s+/g, ' ').trim()
  if (wk && /[가-힣]/.test(wk)) return `${iso} (${wk})`
  return iso
}

/** `KE95506/26 (금) 13:40` — 편명 뒤에 월일이 붙은 롯데관광 UI 형식 */
const LT_FN_DATE_GLUE =
  /^([A-Z]{2})(\d{3,4})(\d{2})\/(\d{2})(?:\s*\(([가-힣])\))?\s*((?:[01]?\d|2[0-3]):[0-5]\d)?/i

/** `06/26(금) 19:40` — 연도 생략(상품 연도는 본문에서 추론) */
const LT_SHORT_DT =
  /(\d{2})\/(\d{2})\s*\(([가-힣])\s*\)\s*((?:[01]?\d|2[0-3]):[0-5]\d)/g

function extractFlightNoFromLine(line: string): string | null {
  const t = line.replace(/\s+/g, ' ').trim()
  if (!t) return null
  const glued = t.match(LT_FN_DATE_GLUE)
  if (glued) return `${glued[1]!.toUpperCase()}${glued[2]!}`
  const standalone = t.match(/^([A-Z]{1,3}\d{2,5})$/i)
  if (standalone) return standalone[1]!.toUpperCase()
  const emb = t.match(/\b([A-Z]{1,3}\d{2,5})\b/i)
  if (!emb) return null
  if (/\d{4}[.\-/]\d{1,2}/.test(t)) return null
  if (/\d{2}\/\d{2}/.test(t) && /[A-Z]{2}\d{5,}/i.test(t)) return null
  return emb[1]!.toUpperCase()
}

function inferLottetourFlightYear(lines: string[]): string {
  const blob = lines.join('\n')
  const y = blob.match(/\b(20\d{2})\b/)?.[1]
  return y ?? String(new Date().getFullYear())
}

function shortDtToIsoField(year: string, mm: string, dd: string, wd: string, time: string): {
  date: string
  time: string
} {
  const iso = `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  const w = (wd ?? '').trim()
  return {
    date: w && /[가-힣]/.test(w) ? `${iso} (${w})` : iso,
    time,
  }
}

function collectShortDateTimesFromText(text: string): Array<{ mm: string; dd: string; wd: string; time: string }> {
  const out: Array<{ mm: string; dd: string; wd: string; time: string }> = []
  const re = new RegExp(LT_SHORT_DT.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    out.push({ mm: m[1]!, dd: m[2]!, wd: m[3]!, time: m[4]! })
  }
  return out
}

function parseLottetourCompactLegChunk(chunk: string[]): Partial<FlightLeg> | null {
  const lines = chunk.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  if (lines.length < 2) return null

  let flightNo: string | null = null
  for (const line of lines) {
    const fn = extractFlightNoFromLine(line)
    if (fn) {
      flightNo = fn
      break
    }
  }
  if (!flightNo) return null

  const year = inferLottetourFlightYear(lines)
  const allDts = lines.flatMap((line) => collectShortDateTimesFromText(line))
  if (allDts.length < 1) return null

  let depAirport: string | null = null
  let arrAirport: string | null = null
  for (const line of lines) {
    const depM = line.match(/^(.+?)\s*출발/u)
    if (depM && !/^(한국|출발|도착)$/u.test(depM[1]!.trim())) {
      depAirport = depM[1]!.trim()
    }
    const arrM = line.match(/^(.+?)\s*도착/u)
    if (arrM && !/^(한국|출발|도착)$/u.test(arrM[1]!.trim())) {
      arrAirport = arrM[1]!.trim()
    }
  }

  const depDt = allDts[0]!
  const arrDt = allDts.length >= 2 ? allDts[allDts.length - 1]! : allDts[0]!
  const dep = shortDtToIsoField(year, depDt.mm, depDt.dd, depDt.wd, depDt.time)
  const arr = shortDtToIsoField(year, arrDt.mm, arrDt.dd, arrDt.wd, arrDt.time)

  if (!depAirport && /인천|ICN/i.test(lines.join(' '))) depAirport = '인천국제공항'
  if (!arrAirport && /이스탄불|IST/i.test(lines.join(' '))) arrAirport = '이스탄불'
  if (!depAirport && /이스탄불|IST/i.test(lines.join(' ')) && allDts.length >= 2) depAirport = '이스탄불'
  if (!arrAirport && /인천|ICN/i.test(lines.join(' ')) && allDts.length >= 2) arrAirport = '인천국제공항'

  if (!depAirport || !arrAirport) return null

  return {
    departureAirport: depAirport,
    departureAirportCode: null,
    departureDate: dep.date,
    departureTime: dep.time,
    arrivalAirport: arrAirport,
    arrivalAirportCode: null,
    arrivalDate: arr.date,
    arrivalTime: arr.time,
    flightNo,
    durationText: null,
  }
}

/** `한국` / `출발` / 편명·공항·도시 3~4줄 압축 블록 */
function tryParseLottetourKoreaDepartArriveCompact(lines: string[]): LottetourFlightBlockParse | null {
  const departIdxs: number[] = []
  const arriveIdxs: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (isLottetourDepartAnchorLine(lines[i]!)) departIdxs.push(i)
    if (isLottetourArriveAnchorLine(lines[i]!)) arriveIdxs.push(i)
  }
  if (!departIdxs.length || !arriveIdxs.length) return null

  let outbound: Partial<FlightLeg> | null = null
  let inbound: Partial<FlightLeg> | null = null

  for (const idxOut of departIdxs) {
    for (const idxIn of arriveIdxs) {
      if (idxIn <= idxOut) continue
      const outChunk = lines.slice(idxOut + 1, idxIn)
      const idxOut2 = lines.findIndex((l, i) => i > idxIn && isLottetourDepartAnchorLine(l))
      const inEnd = idxOut2 >= 0 ? idxOut2 : lines.length
      const inChunk = lines.slice(idxIn + 1, inEnd)
      if (outChunk.length < 2 || inChunk.length < 2) continue
      const ob = parseLottetourCompactLegChunk(outChunk)
      const ib = parseLottetourCompactLegChunk(inChunk)
      if (ob?.flightNo && ib?.flightNo) {
        outbound = ob
        inbound = ib
        break
      }
    }
    if (outbound?.flightNo && inbound?.flightNo) break
  }

  if (!outbound?.flightNo || !inbound?.flightNo) return null
  return { airlineName: extractLottetourAirlineFromLines(lines), outbound, inbound }
}

export function extractLottetourAirlineFromLines(lines: string[]): string | null {
  const blob = lines.join('\n')
  const m =
    blob.match(/(대한항공|아시아나항공|아시아나|제주항공|진에어|티웨이항공|티웨이|에어부산|이스타항공|이스타)/) ??
    blob.match(/([가-힣A-Za-z·\s]{2,20}항공)/)
  return m?.[1]?.replace(/\s+/g, ' ').trim() ?? null
}

function findFlightNoLineIndex(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    if (extractFlightNoFromLine(lines[i] ?? '')) return i
  }
  return -1
}

function isLottetourBlockTotalDurationLine(line: string): boolean {

  const t = line.replace(/\s+/g, ' ').trim()

  if (!t) return false

  if (/^총\s*\d/.test(t) && /(시간|분|hr|min)/i.test(t)) return true

  if (/^약\s*\d/.test(t) && /(시간|분)/.test(t)) return true

  return false

}



function parseLegChunk(chunk: string[]): Partial<FlightLeg> | null {

  const lines = chunk.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)

  const fnIdx = findFlightNoLineIndex(lines)

  if (fnIdx < 0) return null

  let idx = fnIdx + 1

  let durationText: string | null = null

  while (idx < lines.length && isLottetourBlockTotalDurationLine(lines[idx] ?? '')) {

    const piece = (lines[idx] ?? '').trim()

    durationText = durationText ? `${durationText} ${piece}` : piece

    idx++

  }

  if (idx + 3 >= lines.length) return null

  const flightNo = extractFlightNoFromLine(lines[fnIdx] ?? '')

  const depCity = lines[idx] ?? null

  const depRaw = lines[idx + 1] ?? ''

  const arrCity = lines[idx + 2] ?? null

  const arrRaw = lines[idx + 3] ?? ''

  const dm1 = depRaw.trim().match(LT_DT)

  const dm2 = arrRaw.trim().match(LT_DT)

  if (!flightNo || !dm1 || !dm2) return null

  return {

    departureAirport: depCity,

    departureAirportCode: null,

    departureDate: ybDepartureOrArrivalDateField(dm1[1]!, dm1[2]),

    departureTime: dm1[3]!,

    arrivalAirport: arrCity,

    arrivalAirportCode: null,

    arrivalDate: ybDepartureOrArrivalDateField(dm2[1]!, dm2[2]),

    arrivalTime: dm2[3]!,

    flightNo,

    durationText,

  }

}
/** 첫 줄부터 편명 전까지 — 동일 항공사명 중복 줄은 하나로만 채택 */
function firstAirlineName(chunk: string[], fnIdx: number): string | null {
  const head = chunk.slice(0, fnIdx).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const withKw = head.filter((l) => /항공|AIR|Air|airways|에어웨이/i.test(l))
  const pool = withKw.length ? withKw : head
  const first = pool[0] ?? null
  if (!first) return null
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
  const allSame = pool.every((l) => norm(l) === norm(first))
  if (allSame) return norm(first)
  return norm(withKw[0] ?? head[0] ?? first)
}

export type LottetourFlightBlockParse = {
  airlineName: string | null
  outbound: Partial<FlightLeg>
  inbound: Partial<FlightLeg>
}

function isLottetourDepartAnchorLine(line: string): boolean {
  const t = line.replace(/\s+/g, ' ').trim()
  return /^출발\s*:?\s*$/i.test(t)
}

function isLottetourArriveAnchorLine(line: string): boolean {
  const t = line.replace(/\s+/g, ' ').trim()
  return /^도착\s*:?\s*$/i.test(t)
}

/**
 * 본문 상단 `출발`/`도착`(요약 일시만)이 먼저 나오고, 아래쪽 `일정` 표에 SK988 등이 있는 경우가 많음.
 * 모든 출발~도착 쌍을 시도해 편명+일시가 모두 파싱되는 후보 중, 본문에서 가장 아래(일반적으로 상세 표)를 선택.
 */
/**
 * `출발 스칸디나비아항공 … SK988 인천 … 로마 …` 한 줄(또는 동일 구조) — 단독 줄 `출발` 앵커 없음.
 * 편명 뒤: 도시 + (날짜)(요일) 시각 + 도시 + (날짜)(요일) 시각
 */
function parseLottetourInlineLegAfterKeyword(rest: string): Partial<FlightLeg> | null {
  const flat = rest.replace(/\s+/g, ' ').trim()
  if (flat.length < 28) return null
  const fnM = flat.match(/\b([A-Z]{1,3}\d{2,5})\b/i)
  if (!fnM || fnM.index == null) return null
  const flightNo = fnM[1]!.toUpperCase()
  const afterFn = flat.slice(fnM.index + fnM[0].length).trim()
  const re = new RegExp(LT_DT.source, 'g')
  const matches: RegExpExecArray[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(afterFn)) !== null) matches.push(m)
  if (matches.length < 2) return null
  const dm1 = matches[0]!
  const dm2 = matches[1]!
  const betweenFnAndFirstDt = afterFn.slice(0, dm1.index ?? 0).trim()
  const depCity = betweenFnAndFirstDt.split(/\s+/).filter(Boolean).pop() ?? ''
  const between = afterFn.slice((dm1.index ?? 0) + dm1[0].length, dm2.index ?? 0).trim()
  const arrCity = between.split(/\s+/).filter(Boolean).pop() ?? between.split(/\s+/)[0] ?? ''
  if (!depCity || !arrCity) return null
  return {
    departureAirport: depCity,
    departureAirportCode: null,
    departureDate: ybDepartureOrArrivalDateField(dm1[1]!, dm1[2]),
    departureTime: dm1[3]!,
    arrivalAirport: arrCity,
    arrivalAirportCode: null,
    arrivalDate: ybDepartureOrArrivalDateField(dm2[1]!, dm2[2]),
    arrivalTime: dm2[3]!,
    flightNo,
    durationText: null,
  }
}

function isLottetourInlineDepartLine(line: string): boolean {
  const t = line.replace(/\s+/g, ' ').trim()
  if (!/^출발\s+/i.test(t)) return false
  if (isLottetourDepartAnchorLine(line)) return false
  return t.length > 12
}

function isLottetourInlineArriveLine(line: string): boolean {
  const t = line.replace(/\s+/g, ' ').trim()
  if (!/^도착\s+/i.test(t)) return false
  if (isLottetourArriveAnchorLine(line)) return false
  return t.length > 12
}

function tryParseLottetourFlightBlocksInline(lines: string[]): LottetourFlightBlockParse | null {
  const departIdxs: number[] = []
  const arriveIdxs: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (isLottetourInlineDepartLine(lines[i]!)) departIdxs.push(i)
    if (isLottetourInlineArriveLine(lines[i]!)) arriveIdxs.push(i)
  }
  if (!departIdxs.length || !arriveIdxs.length) return null
  type Cand = {
    airlineName: string | null
    outbound: Partial<FlightLeg>
    inbound: Partial<FlightLeg>
    score: number
  }
  const cands: Cand[] = []
  for (const idxOut of departIdxs) {
    for (const idxIn of arriveIdxs) {
      if (idxIn <= idxOut) continue
      const outRest = lines[idxOut]!.replace(/^\s*출발\s+/i, '').trim()
      const inRest = lines[idxIn]!.replace(/^\s*도착\s+/i, '').trim()
      const ob = parseLottetourInlineLegAfterKeyword(outRest)
      const ib = parseLottetourInlineLegAfterKeyword(inRest)
      if (!ob?.flightNo || !ib?.flightNo) continue
      const fnIx = (s: string) => {
        const i = s.search(/\b[A-Z]{1,3}\d{2,5}\b/i)
        return i >= 0 ? i : s.length
      }
      const airlineOut = outRest.slice(0, fnIx(outRest)).trim()
      const airlineIn = inRest.slice(0, fnIx(inRest)).trim()
      const pickAir = (s: string) => {
        const parts = s.split(/\s+/).filter(Boolean)
        const withKw = parts.filter((p) => /항공|AIR|Air|airways|에어웨이/i.test(p))
        const pool = withKw.length ? withKw : parts
        return pool[0] ?? null
      }
      const airlineName = pickAir(airlineOut) ?? pickAir(airlineIn) ?? null
      cands.push({ airlineName, outbound: ob, inbound: ib, score: idxOut * 100000 + idxIn })
    }
  }
  if (!cands.length) return null
  cands.sort((a, b) => a.score - b.score)
  const best = cands[cands.length - 1]!
  return {
    airlineName: best.airlineName,
    outbound: best.outbound,
    inbound: best.inbound,
  }
}

/**
 * 「여행 주요일정」 등 한 줄 슬래시 구조 (SSOT — 일차 본문 속 다구간 항공에 흔들리지 않음).
 * 출발편: SK988 / 인천 / 2026.07.15 (수) 23:45 / 로마 / 2026.07.16 (목) 11:05
 */
function parseLottetourMainScheduleLegLine(line: string): Partial<FlightLeg> | null {
  const parts = line
    .split(/\s*\/\s*/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length < 5) return null
  const flightNo = parts[0]!.match(/^([A-Z]{1,3}\d{2,5})$/i)?.[1]?.toUpperCase()
  if (!flightNo) return null
  const depCity = parts[1] ?? ''
  const depRaw = parts[2] ?? ''
  const arrCity = parts[3] ?? ''
  const arrRaw = parts[4] ?? ''
  const dm1 = depRaw.trim().match(LT_DT)
  const dm2 = arrRaw.trim().match(LT_DT)
  if (!flightNo || !dm1 || !dm2) return null
  return {
    departureAirport: depCity,
    departureAirportCode: null,
    departureDate: ybDepartureOrArrivalDateField(dm1[1]!, dm1[2]),
    departureTime: dm1[3]!,
    arrivalAirport: arrCity,
    arrivalAirportCode: null,
    arrivalDate: ybDepartureOrArrivalDateField(dm2[1]!, dm2[2]),
    arrivalTime: dm2[3]!,
    flightNo,
    durationText: null,
  }
}

function extractLottetourAirlineBeforeMainSchedule(blob: string): string | null {
  const head = blob.split(/출발편\s*[:：]/i)[0] ?? blob
  const m = head.match(/([\w가-힣·\s]{2,36}항공)/)
  return m?.[1]?.replace(/\s+/g, ' ').trim() ?? null
}

/** 본문 전체에서 `출발편`/`도착편` 슬래시 라인을 찾는다 (여행 주요일정 블록 우선). */
export function parseLottetourTravelMainScheduleFlight(blob: string): LottetourFlightBlockParse | null {
  const flat = blob.replace(/\r/g, '\n')
  const outM = flat.match(/출발편\s*[:：]?\s*([^\n]+)/i)
  const inM = flat.match(/도착편\s*[:：]?\s*([^\n]+)/i)
  if (!outM?.[1]?.trim() || !inM?.[1]?.trim()) return null
  const outbound = parseLottetourMainScheduleLegLine(outM[1]!.trim())
  const inbound = parseLottetourMainScheduleLegLine(inM[1]!.trim())
  if (!outbound?.flightNo || !inbound?.flightNo) return null
  const airlineName = extractLottetourAirlineBeforeMainSchedule(flat)
  return { airlineName, outbound, inbound }
}

export function tryParseLottetourFlightBlocks(section: string): LottetourFlightBlockParse | null {
  const lines = stripLogoNoise(section)
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const compact = tryParseLottetourKoreaDepartArriveCompact(lines)
  if (compact?.outbound?.flightNo && compact.inbound?.flightNo) return compact

  const departIdxs: number[] = []
  const arriveIdxs: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (isLottetourDepartAnchorLine(lines[i]!)) departIdxs.push(i)
    if (isLottetourArriveAnchorLine(lines[i]!)) arriveIdxs.push(i)
  }
  if (!departIdxs.length || !arriveIdxs.length) {
    const inline = tryParseLottetourFlightBlocksInline(lines)
    if (inline) return inline
    return null
  }

  type Cand = {
    airlineName: string | null
    outbound: Partial<FlightLeg>
    inbound: Partial<FlightLeg>
    score: number
  }
  const cands: Cand[] = []

  for (const idxOut of departIdxs) {
    for (const idxIn of arriveIdxs) {
      if (idxIn <= idxOut) continue
      const outChunk = lines.slice(idxOut + 1, idxIn)
      if (outChunk.length < 2) continue
      if (outChunk.length < 5) {
        const compactOb = parseLottetourCompactLegChunk(outChunk)
        if (compactOb?.flightNo) {
          const idxOut2Early = lines.findIndex((l, i) => i > idxIn && isLottetourDepartAnchorLine(l))
          const inEndEarly = idxOut2Early >= 0 ? idxOut2Early : lines.length
          const inChunkEarly = lines.slice(idxIn + 1, inEndEarly)
          const compactIb = inChunkEarly.length >= 2 ? parseLottetourCompactLegChunk(inChunkEarly) : null
          if (compactIb?.flightNo) {
            cands.push({
              airlineName: extractLottetourAirlineFromLines(lines),
              outbound: compactOb,
              inbound: compactIb,
              score: idxOut * 100000 + idxIn,
            })
          }
        }
        continue
      }
      const idxOut2 = lines.findIndex((l, i) => i > idxIn && isLottetourDepartAnchorLine(l))
      const inEnd = idxOut2 >= 0 ? idxOut2 : lines.length
      const inChunk = lines.slice(idxIn + 1, inEnd)
      if (inChunk.length < 5) continue
      const fnOut = findFlightNoLineIndex(outChunk)
      const fnIn = findFlightNoLineIndex(inChunk)
      if (fnOut < 0 || fnIn < 0) continue
      const ob = parseLegChunk(outChunk)
      const ib = parseLegChunk(inChunk)
      if (!ob?.flightNo || !ib?.flightNo) continue
      const a1 = firstAirlineName(outChunk, fnOut)
      const a2 = firstAirlineName(inChunk, fnIn)
      const airlineName = a1 ?? a2 ?? null
      const score = idxOut * 100000 + idxIn
      cands.push({ airlineName, outbound: ob, inbound: ib, score })
    }
  }

  if (!cands.length) {
    return tryParseLottetourFlightBlocksInline(lines)
  }
  cands.sort((a, b) => a.score - b.score)
  const best = cands[cands.length - 1]!
  return {
    airlineName: best.airlineName,
    outbound: best.outbound,
    inbound: best.inbound,
  }
}

/**
 * 실제 붙여넣기: `출발편:` 한 줄이 없고 `여행 주요일정` 표 안에만 `출발`/`도착`+편명 블록이 있는 경우.
 * 슬라이스로 일차 본문의 SK1560 등을 제외해 대표 왕복(SK988/SK987)만 남긴다.
 */
export function parseLottetourTravelMainScheduleFlightFromTable(blob: string): LottetourFlightBlockParse | null {
  const flat = blob.replace(/\r/g, '\n')
  const m = /여행\s*주요일정/.exec(flat)
  if (!m) return null
  const after = flat.slice(m.index)
  const endM = /(?:^|\n)\s*(?:예약현황|방문도시)(?:\s|$)/m.exec(after)
  const slice = endM ? after.slice(0, endM.index) : after.slice(0, 12000)
  return tryParseLottetourFlightBlocks(slice)
}

/** generic 선호 레그용 한 줄 요약 */
export function lottetourSynthesizePreferredRaw(leg: Partial<FlightLeg>, label: '가는편' | '오는편'): string {
  const p = [
    label,
    leg.flightNo,
    leg.departureAirport,
    leg.departureDate,
    leg.departureTime,
    leg.arrivalAirport,
    leg.arrivalDate,
    leg.arrivalTime,
  ]
    .filter(Boolean)
    .join(' ')
  return p
}
