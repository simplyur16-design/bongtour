/**
 * 한진투어 관리자 항공 정형칸(출발/도착 블록) → `FlightStructured`.
 * `flight-parser-ybtour`는 연·월·일 4자리 연도 위주라 2자리(26.04.15) 붙여넣기에 실패할 때 보조.
 */
import type { FlightStructured } from '@/lib/detail-body-parser-types'
import { createEmptyFlightLeg } from '@/lib/flight-parser-generic'

type Leg = FlightStructured['outbound']

const DT2 = /(\d{2})\.(\d{2})\.(\d{2})\s*\(([^)]*)\)\s*((?:[01]?\d|2[0-3]):[0-5]\d)/

function isoFromYy(mmdd: string[]): string {
  const [yy, mm, dd] = mmdd.map((x) => x.padStart(2, '0'))
  const y = Number(yy) >= 70 ? `19${yy}` : `20${yy}`
  return `${y}-${mm}-${dd}`
}

function extractFlightNo(lines: string[]): string | null {
  for (const line of lines) {
    const m = line.match(/([A-Z]{2,3}\d{2,4})편?/i)
    if (m?.[1]) return m[1]!.toUpperCase()
  }
  return null
}

function extractDuration(lines: string[]): string | null {
  for (const line of lines) {
    const t = line.replace(/\s+/g, ' ').trim()
    if (/^총\s*.+(소요|분|시간)/u.test(t)) return t
  }
  return null
}

function extractAirlineName(lines: string[]): string | null {
  for (const line of lines) {
    const t = line.replace(/\s+/g, ' ').trim()
    if (/편$/u.test(t) || /^총\s/u.test(t)) continue
    if (/^이동$/u.test(t)) continue
    if (/^\d{2}\.\d{2}\.\d{2}/u.test(t)) continue
    if (/^[A-Z]{2,3}\d{2,4}편?$/iu.test(t)) continue
    if (/[A-Z]{2,3}\d{2,4}/i.test(t) && t.length < 16) continue
    if (t.length >= 2 && t.length <= 24 && /[가-힣A-Za-z]/.test(t)) return t
  }
  return null
}

/** `서울(ICN)` 다음 줄 `26.04.15 (수) 21:00` … `이동` … 도착지·도착일시 */
function parseLegFromLines(lines: string[]): Partial<Leg> | null {
  const fn = extractFlightNo(lines)
  const durationText = extractDuration(lines)
  if (!fn) return null
  const i = lines.findIndex((l) => DT2.test(l))
  if (i < 1) return null
  const depM = lines[i]!.match(DT2)
  if (!depM) return null
  const depAirportLine = lines[i - 1]!.trim()
  let j = i + 1
  while (j < lines.length && /^이동$/u.test(lines[j]!.trim())) j++
  const arrAirportLine = (lines[j] ?? '').trim()
  const arrM = lines[j + 1]?.match(DT2)
  if (!arrAirportLine || !arrM) return null
  const [, dyy, dmm, ddd, dwk, dtm] = depM
  const [, ayy, amm, add, awk, atm] = arrM
  return {
    flightNo: fn,
    durationText: durationText ?? null,
    departureAirport: depAirportLine,
    departureAirportCode: null,
    departureDate: `${isoFromYy([dyy!, dmm!, ddd!])} (${dwk})`,
    departureTime: dtm!,
    arrivalAirport: arrAirportLine,
    arrivalAirportCode: null,
    arrivalDate: `${isoFromYy([ayy!, amm!, add!])} (${awk})`,
    arrivalTime: atm!,
  }
}

function splitOutInbound(text: string): { out: string[]; inn: string[] } | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const di = lines.findIndex((l) => /^출발$/u.test(l))
  const ai = lines.findIndex((l) => /^도착$/u.test(l))
  if (di < 0 || ai < 0 || ai <= di) return null
  return { out: lines.slice(di + 1, ai), inn: lines.slice(ai + 1) }
}

export function parseHanjintourAirlineTransportPaste(section: string): FlightStructured | null {
  const trimmed = section.trim()
  if (!trimmed) return null
  const chunks = splitOutInbound(trimmed)
  if (!chunks) return null
  const ob = parseLegFromLines(chunks.out)
  const ib = parseLegFromLines(chunks.inn)
  if (!ob?.flightNo || !ib?.flightNo) return null
  const empty = createEmptyFlightLeg()
  const airlineName = extractAirlineName(chunks.out) ?? extractAirlineName(chunks.inn)
  const fs: FlightStructured = {
    airlineName,
    outbound: { ...empty, ...ob },
    inbound: { ...empty, ...ib },
    rawFlightLines: trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 24),
    debug: {
      candidateCount: 2,
      selectedOutRaw: chunks.out.join('\n'),
      selectedInRaw: chunks.inn.join('\n'),
      partialStructured: false,
      status: 'success',
      exposurePolicy: 'admin_only',
      supplierBrandKey: 'hanjintour',
      expectFlightNumber: true,
    },
    reviewNeeded: false,
    reviewReasons: [],
  }
  return fs
}

export function mergeHanjintourFlightPaste(
  ybtourResult: FlightStructured,
  paste: string
): FlightStructured {
  const hj = parseHanjintourAirlineTransportPaste(paste)
  if (!hj) return ybtourResult
  const ybOk = ybtourResult.debug?.status === 'success' || ybtourResult.debug?.status === 'partial'
  const ybHas =
    Boolean(ybtourResult.outbound.flightNo?.trim()) && Boolean(ybtourResult.inbound.flightNo?.trim())
  if (ybOk && ybHas) return ybtourResult
  return hj
}
