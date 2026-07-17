/**
 * 교원이지(kyowontour) 등록 — goodsEventDetail HTML에서 상품명·항공·잔여석 SSOT.
 *
 * REGRESSION-FREEZE[kyowontour-register-api-detail]: title·flight·seats HTML extract — manifest
 */
import type { FlightStructured } from '@/lib/detail-body-parser-types'
import { createEmptyFlightLeg } from '@/lib/flight-parser-generic'

export type KyowontourDetailTrafficLeg = {
  label: string
  departureDate: string | null
  departureTime: string | null
  flightNo: string | null
}

function pad2(n: string): string {
  return n.padStart(2, '0')
}

/** `2026년 06월 27일 (토) 10:25` → date `2026-06-27 (토)`, time `10:25` */
export function parseKyowontourTrafficDateTimeToken(raw: string): {
  departureDate: string | null
  departureTime: string | null
  flightNo: string | null
} {
  const flat = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const m = flat.match(
    /(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*(?:\(([^)]+)\))?\s*(\d{1,2}:\d{2})\s*([A-Z]{1,3}\d{2,5})?/i,
  )
  if (!m) {
    const fnOnly = flat.match(/\b([A-Z]{1,3}\d{2,5})\b/i)
    return { departureDate: null, departureTime: null, flightNo: fnOnly?.[1]?.toUpperCase() ?? null }
  }
  const iso = `${m[1]}-${pad2(m[2]!)}-${pad2(m[3]!)}`
  const weekday = m[4]?.trim()
  const departureDate = weekday ? `${iso} (${weekday})` : iso
  const flightNo = m[6]?.toUpperCase() ?? flat.match(/\b([A-Z]{1,3}\d{2,5})\b/i)?.[1]?.toUpperCase() ?? null
  return { departureDate, departureTime: m[5] ?? null, flightNo }
}

export function extractKyowontourProductTitleFromDetailHtml(html: string): string | null {
  const decode = (s: string) =>
    s
      .replace(/&amp;/gi, '&')
      .replace(/&#38;/g, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
  // REGRESSION-FREEZE[kyowontour-register-api-detail]: title HTML entity decode (&amp;) — manifest
  const tourTitle = html.match(/tourTitle\s*=\s*'([^']{8,240})'/i)?.[1]?.trim()
  if (tourTitle && /[가-힣#★]/.test(tourTitle)) return decode(tourTitle)
  const hit = html.match(/(★[^<'"]{10,200}HIT)/i)?.[1]?.trim()
  if (hit) return decode(hit)
  const og = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)?.[1]?.trim()
  if (og && !/여행이지\s*:\s*그래/i.test(og)) return decode(og)
  const h1 = html.match(/<h1[^>]*class="[^"]*tit[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
  if (h1) {
    const t = decode(h1.replace(/<[^>]+>/g, ' '))
    if (t.length >= 8) return t
  }
  return null
}

export function extractKyowontourAirlineNameFromDetailHtml(html: string): string | null {
  const nearTraffic = html.match(
    /<strong>\s*이용교통\s*<\/strong>[\s\S]{0,400}?<span\s+class="txt">\s*([^<]{2,40})\s*<\/span>/i,
  )?.[1]
  if (nearTraffic?.trim()) return nearTraffic.replace(/\s+/g, ' ').trim()
  const hashTag = html.match(/#([가-힣A-Za-z]{2,12}항공)/)?.[1]
  if (hashTag) return hashTag
  return null
}

function parseTrafficLegFromHtml(html: string, label: string): KyowontourDetailTrafficLeg | null {
  const re = new RegExp(`<dt>\\s*${label}\\s*<\\/dt>\\s*<dd>([\\s\\S]*?)<\\/dd>`, 'i')
  const m = html.match(re)
  if (!m?.[1]) return null
  const parsed = parseKyowontourTrafficDateTimeToken(m[1])
  if (!parsed.departureDate && !parsed.flightNo) return null
  return { label, ...parsed }
}

export function extractKyowontourTrafficLegsFromDetailHtml(html: string): KyowontourDetailTrafficLeg[] {
  const labels = ['한국출발', '현지출발', '현지도착', '한국도착'] as const
  const out: KyowontourDetailTrafficLeg[] = []
  for (const label of labels) {
    const leg = parseTrafficLegFromHtml(html, label)
    if (leg) out.push(leg)
  }
  return out
}

export type KyowontourDetailSeatsMeta = {
  remainingSeatsCount: number | null
  minimumDepartureCount: number | null
  currentBookedCount: number | null
  seatsStatusRaw: string | null
}

export function parseKyowontourRemainingSeatsFromDetailHtml(html: string): KyowontourDetailSeatsMeta {
  let remainingSeatsCount: number | null = null
  let minimumDepartureCount: number | null = null
  let currentBookedCount: number | null = null

  const remainEm = html.match(/남은\s*좌석\s*<em[^>]*>\s*(\d+)\s*<\/em>\s*석/i)
  if (remainEm) remainingSeatsCount = Number(remainEm[1])

  if (remainingSeatsCount == null) {
    const remainPlain = html.match(/남은\s*좌석\s*(\d+)\s*석/)
    if (remainPlain) remainingSeatsCount = Number(remainPlain[1])
  }
  if (remainingSeatsCount == null) {
    const remAlt = html.match(/잔여\s*(\d+)\s*석/)
    if (remAlt) remainingSeatsCount = Number(remAlt[1])
  }

  const bookedEm = html.match(/예약\s*<em[^>]*>\s*(\d+)\s*<\/em>\s*명/i)
  if (bookedEm) currentBookedCount = Number(bookedEm[1])
  if (currentBookedCount == null) {
    const bookedPlain = html.match(/예약\s*(\d+)\s*명/)
    if (bookedPlain) currentBookedCount = Number(bookedPlain[1])
  }

  const minEm = html.match(/최소\s*출발\s*인원\s*<em[^>]*>\s*(\d+)\s*<\/em>\s*명/i)
  if (minEm) minimumDepartureCount = Number(minEm[1])
  if (minimumDepartureCount == null) {
    const minPlain = html.match(/최소\s*출발\s*인원\s*(\d+)\s*명/)
    if (minPlain) minimumDepartureCount = Number(minPlain[1])
  }

  const seatsStatusRaw =
    remainingSeatsCount != null && remainingSeatsCount >= 0 ? `잔여${remainingSeatsCount}석` : null

  return { remainingSeatsCount, minimumDepartureCount, currentBookedCount, seatsStatusRaw }
}

export function buildKyowontourFlightStructuredFromDetailHtml(html: string): FlightStructured | null {
  const legs = extractKyowontourTrafficLegsFromDetailHtml(html)
  const obLeg = legs.find((l) => l.label === '한국출발')
  const ibLeg = legs.find((l) => l.label === '한국도착')
  if (!obLeg?.flightNo || !ibLeg?.flightNo || !obLeg.departureTime || !ibLeg.departureTime) return null

  const airlineName = extractKyowontourAirlineNameFromDetailHtml(html)
  const empty = createEmptyFlightLeg()
  const outbound = {
    ...empty,
    departureAirport: '인천',
    departureDate: obLeg.departureDate,
    departureTime: obLeg.departureTime,
    flightNo: obLeg.flightNo,
    arrivalDate: legs.find((l) => l.label === '현지도착')?.departureDate ?? obLeg.departureDate,
    arrivalTime: legs.find((l) => l.label === '현지도착')?.departureTime ?? null,
  }
  const inbound = {
    ...empty,
    departureAirport: legs.find((l) => l.label === '현지출발') ? '현지' : null,
    departureDate: legs.find((l) => l.label === '현지출발')?.departureDate ?? ibLeg.departureDate,
    departureTime: legs.find((l) => l.label === '현지출발')?.departureTime ?? ibLeg.departureTime,
    arrivalAirport: '인천',
    arrivalDate: ibLeg.departureDate,
    arrivalTime: ibLeg.departureTime,
    flightNo: ibLeg.flightNo,
  }

  return {
    airlineName,
    outbound,
    inbound,
    rawFlightLines: [
      `한국출발 ${obLeg.flightNo} ${obLeg.departureDate ?? ''} ${obLeg.departureTime ?? ''}`.trim(),
      `한국도착 ${ibLeg.flightNo} ${ibLeg.departureDate ?? ''} ${ibLeg.departureTime ?? ''}`.trim(),
    ],
    debug: {
      candidateCount: legs.length,
      selectedOutRaw: obLeg.flightNo,
      selectedInRaw: ibLeg.flightNo,
      partialStructured: false,
      status: 'success',
      exposurePolicy: 'public_full',
      supplierBrandKey: 'kyowontour',
      expectFlightNumber: true,
    },
    reviewNeeded: false,
    reviewReasons: [],
  }
}
