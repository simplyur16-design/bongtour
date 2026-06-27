/**
 * 참좋은여행 PackageDetail HTML — 등록 API SSOT (제목·항공·잔여석·옵션·쇼핑).
 * REGRESSION-FREEZE[verygoodtour-register-api-detail]: manifest
 */
import type { FlightStructured } from '@/lib/detail-body-parser-types'
import { createEmptyFlightLeg } from '@/lib/flight-parser-generic'
import { parseFlightSectionVerygoodtour } from '@/lib/flight-parser-verygoodtour'
import { buildOptionalToursStructuredForRegisterJson } from '@/lib/register-optional-tours-detail-final-merge'
import type { RegisterFactPriceRow } from '@/lib/register-facts/types'
import { filterOptionalTourRows } from '@/lib/optional-tour-row-gate-verygoodtour'
import { extractStructuredTourSignals, type StructuredOptionalTourRow, type StructuredShoppingStopRow } from '@/lib/structured-tour-signals-verygoodtour'
import { parseVerygoodProCodeVariant } from '@/lib/verygoodtour-procode-detail-meta'
import { extractVerygoodDetailFlightFactsFromHtml } from '@/lib/verygoodtour-departures'

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripInoutBlockText(html: string, className: 'depature' | 'entry'): string {
  const m = html.match(new RegExp(`<div class="inout ${className}">([\\s\\S]*?)<\\/div><\\/div>`, 'i'))
  if (!m?.[1]) return ''
  return m[1]
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function enrichLegFromInoutBlock(
  leg: FlightStructured['outbound'],
  blockText: string,
  direction: 'outbound' | 'inbound',
): FlightStructured['outbound'] {
  const next = { ...leg }
  const fn = blockText.match(/\b([A-Z]{2})\s*(\d{3,4})\b/)
  if (fn && !next.flightNo?.trim()) {
    next.flightNo = `${fn[1]}${fn[2]}`
  }
  const timeAirport =
    direction === 'outbound'
      ? blockText.match(/(\d{1,2}:\d{2})\s+([^\d]{2,24}?)\s*(?:국제)?\s*공항?\s*(출발|도착)/)
      : blockText.match(/(\d{1,2}:\d{2})\s+([^\d]{2,24}?)\s*(?:국제)?\s*공항?\s*(출발|도착)/)
  if (timeAirport) {
    const [, time, airport, kind] = timeAirport
    if (kind === '출발') {
      if (!next.departureTime?.trim()) next.departureTime = time ?? null
      if (!next.departureAirport?.trim()) next.departureAirport = airport?.trim() ?? null
    } else {
      if (!next.arrivalTime?.trim()) next.arrivalTime = time ?? null
      if (!next.arrivalAirport?.trim()) next.arrivalAirport = airport?.trim() ?? null
    }
  }
  return next
}

function normalizeVerygoodFlightNo(raw: string | null | undefined): string | null {
  const m = String(raw ?? '').match(/\b([A-Z]{2})\s*(\d{3,4})\b/i)
  return m ? `${m[1]!.toUpperCase()}${m[2]!}` : null
}

function extractVerygoodHeroFlightFromDetailText(text: string): {
  outbound: FlightStructured['outbound']
  inbound: FlightStructured['inbound']
} | null {
  const flat = text.replace(/\s+/g, ' ')
  const outHero = flat.match(
    /한국출발\s+(\d{4}\.\d{1,2}\.\d{1,2})\s*(?:\([^)]*\))?\s*(\d{1,2}:\d{2})\s+(.+?)\s+출발\s+(\d{4}\.\d{1,2}\.\d{1,2})\s*(?:\([^)]*\))?\s*(\d{1,2}:\d{2})\s+(.+?)\s+도착/,
  )
  const inHero = flat.match(
    /한국도착\s+(\d{4}\.\d{1,2}\.\d{1,2})\s*(?:\([^)]*\))?\s*(\d{1,2}:\d{2})\s+(.+?)\s+출발\s+(\d{4}\.\d{1,2}\.\d{1,2})\s*(?:\([^)]*\))?\s*(\d{1,2}:\d{2})\s+(.+?)\s+도착/,
  )
  if (!outHero && !inHero) return null

  const fnMatches = [...flat.matchAll(/\[(?:[^\]]*?\s)?([A-Z]{2})\s*(\d{3,4})\s*편?\]/gi)].map((m) =>
    normalizeVerygoodFlightNo(`${m[1]}${m[2]}`),
  )
  const uniqueFns = [...new Set(fnMatches.filter(Boolean))] as string[]

  const toIso = (ymd: string) => ymd.replace(/\./g, '-').slice(0, 10)
  const outbound = createEmptyFlightLeg()
  const inbound = createEmptyFlightLeg()

  if (outHero) {
    outbound.departureDate = toIso(outHero[1]!)
    outbound.departureTime = outHero[2]!
    outbound.departureAirport = outHero[3]!.trim()
    outbound.arrivalDate = toIso(outHero[4]!)
    outbound.arrivalTime = outHero[5]!
    outbound.arrivalAirport = outHero[6]!.trim()
  }
  if (inHero) {
    inbound.departureDate = toIso(inHero[1]!)
    inbound.departureTime = inHero[2]!
    inbound.departureAirport = inHero[3]!.trim()
    inbound.arrivalDate = toIso(inHero[4]!)
    inbound.arrivalTime = inHero[5]!
    inbound.arrivalAirport = inHero[6]!.trim()
  }

  if (uniqueFns[0]) outbound.flightNo = uniqueFns[0]
  if (uniqueFns[1]) inbound.flightNo = uniqueFns[1]

  const legDetailOut =
    flat.match(
      /\[(?:[^\]]*?\s)?([A-Z]{2})\s*(\d{3,4})\s*편?\]\s*(\d{1,2}:\d{2})\s+(.+?)\s+출발\s*-\s*(\d{1,2}:\d{2})\s+(.+?)\s+공항?\s+도착/i,
    ) ?? null
  if (legDetailOut) {
    outbound.flightNo = normalizeVerygoodFlightNo(`${legDetailOut[1]}${legDetailOut[2]}`) ?? outbound.flightNo
    if (!outbound.departureTime) outbound.departureTime = legDetailOut[3]!
    if (!outbound.arrivalTime) outbound.arrivalTime = legDetailOut[5]!
  }
  const legDetailIn =
    flat.match(
      /(\d{1,2}:\d{2})\s+(.+?)\s+국제?\s*공항?\s+출발[^[]*\[(?:[^\]]*?\s)?([A-Z]{2})\s*(\d{3,4})\s*편?\][^0-9]*(\d{1,2}:\d{2})/i,
    ) ?? null
  if (legDetailIn) {
    inbound.flightNo = normalizeVerygoodFlightNo(`${legDetailIn[3]}${legDetailIn[4]}`) ?? inbound.flightNo
    if (!inbound.departureTime) inbound.departureTime = legDetailIn[1]!
    if (!inbound.arrivalTime) inbound.arrivalTime = legDetailIn[5]!
  }

  return { outbound, inbound }
}

/** PackageDetail HTML → flightStructured (편명·시간·공항). */
export function buildVerygoodFlightStructuredFromDetailHtml(html: string): FlightStructured | null {
  const depText = stripInoutBlockText(html, 'depature')
  const entText = stripInoutBlockText(html, 'entry')
  const facts = extractVerygoodDetailFlightFactsFromHtml(html)
  const plainText = stripHtmlToText(html)
  const slice = [depText, entText].filter(Boolean).join('\n\n')
  const parsed = parseFlightSectionVerygoodtour(slice || plainText, plainText)
  const hero = extractVerygoodHeroFlightFromDetailText(plainText)

  let outbound = parsed.outbound?.departureAirport ? parsed.outbound : createEmptyFlightLeg()
  let inbound = parsed.inbound?.departureAirport ? parsed.inbound : createEmptyFlightLeg()

  if (hero) {
    outbound = {
      ...outbound,
      ...Object.fromEntries(Object.entries(hero.outbound).filter(([, v]) => v != null && String(v).trim())),
    } as FlightStructured['outbound']
    inbound = {
      ...inbound,
      ...Object.fromEntries(Object.entries(hero.inbound).filter(([, v]) => v != null && String(v).trim())),
    } as FlightStructured['inbound']
  }

  if (!outbound.departureAirport && facts.outboundDepartureAirport) {
    outbound = { ...outbound, departureAirport: facts.outboundDepartureAirport }
  }
  if (!outbound.arrivalAirport && facts.outboundArrivalAirport) {
    outbound = { ...outbound, arrivalAirport: facts.outboundArrivalAirport }
  }
  if (!inbound.departureAirport && facts.inboundDepartureAirport) {
    inbound = { ...inbound, departureAirport: facts.inboundDepartureAirport }
  }
  if (!inbound.arrivalAirport && facts.inboundArrivalAirport) {
    inbound = { ...inbound, arrivalAirport: facts.inboundArrivalAirport }
  }

  outbound = enrichLegFromInoutBlock(outbound, depText, 'outbound')
  inbound = enrichLegFromInoutBlock(inbound, entText, 'inbound')

  const airlineName = parsed.airlineName?.trim() || facts.carrierName?.trim() || null
  const hasCore =
    Boolean(airlineName) &&
    Boolean(outbound.flightNo?.trim() || outbound.departureTime?.trim()) &&
    Boolean(inbound.flightNo?.trim() || inbound.departureTime?.trim())
  if (!hasCore && !outbound.departureAirport && !inbound.departureAirport) return null

  return {
    ...parsed,
    airlineName,
    outbound,
    inbound,
    debug: {
      ...(parsed.debug ?? {
        candidateCount: 0,
        selectedOutRaw: null,
        selectedInRaw: null,
        partialStructured: false,
        exposurePolicy: 'admin_only' as const,
        secondaryScanBlockCount: 0,
        secondaryFlightSnippet: null,
        supplierBrandKey: 'verygoodtour',
        expectFlightNumber: true,
      }),
      status: hasCore ? 'success' : parsed.debug?.status ?? 'partial',
    },
    reviewNeeded: !hasCore,
    reviewReasons: hasCore ? [] : parsed.reviewReasons ?? ['PackageDetail hero flight incomplete'],
  }
}

export function proCodeVariantToIsoYmd(proCode: string): string | null {
  const parts = parseVerygoodProCodeVariant(proCode)
  if (!parts || parts.yymmdd.length !== 6) return null
  const yy = parts.yymmdd.slice(0, 2)
  const mm = parts.yymmdd.slice(2, 4)
  const dd = parts.yymmdd.slice(4, 6)
  return `20${yy}-${mm}-${dd}`
}

export type VerygoodDetailBookingMeta = {
  remainingSeatsCount: number | null
  currentBookedCount: number | null
  minimumDepartureCount: number | null
  seatsStatusRaw: string | null
  departureStatusText: string | null
}

function positiveSeatInt(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null
}

/** PackageDetail HTML 예약현황·Braze productJson — 잔여석·현재예약·최소출발 SSOT */
export function parseVerygoodBookingMetaFromDetailHtml(html: string): VerygoodDetailBookingMeta {
  let remainingSeatsCount: number | null = null
  let currentBookedCount: number | null = null
  let minimumDepartureCount: number | null = null

  const remainEm = html.match(/(?:잔여|남은\s*좌석)\s*<span[^>]*>\s*(\d+)\s*<\/span>\s*석/i)
  if (remainEm) remainingSeatsCount = positiveSeatInt(remainEm[1])
  if (remainingSeatsCount == null) {
    const remPlain = html.match(/(?:잔여|남은\s*좌석)\s*(\d+)\s*석/i)
    if (remPlain) remainingSeatsCount = positiveSeatInt(remPlain[1])
  }

  const currentEm = html.match(/현재\s*예약\s*<span[^>]*>\s*(\d+)\s*<\/span>\s*명/i)
  if (currentEm) currentBookedCount = positiveSeatInt(currentEm[1])
  if (currentBookedCount == null) {
    const curPlain = html.match(/현재\s*예약\s*(\d+)\s*명/i)
    if (curPlain) currentBookedCount = positiveSeatInt(curPlain[1])
  }

  const minEm = html.match(/최소\s*출발\s*<span[^>]*>\s*(\d+)\s*<\/span>\s*명/i)
  if (minEm) minimumDepartureCount = positiveSeatInt(minEm[1])
  if (minimumDepartureCount == null) {
    const minPlain = html.match(/최소\s*출발\s*(\d+)\s*명/i)
    if (minPlain) minimumDepartureCount = positiveSeatInt(minPlain[1])
  }

  const anchor = html.indexOf('"booking_status"')
  if (anchor >= 0) {
    const start = html.lastIndexOf('{', anchor)
    const end = html.indexOf('};', anchor)
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(html.slice(start, end + 1)) as Record<string, unknown>
        if (currentBookedCount == null) {
          currentBookedCount = positiveSeatInt(parsed.current_booking_count)
        }
        if (minimumDepartureCount == null) {
          minimumDepartureCount = positiveSeatInt(parsed.minimum_booking_count)
        }
      } catch {
        /* ignore malformed braze json */
      }
    }
  }

  const seatsStatusRaw =
    remainingSeatsCount != null ? `잔여${remainingSeatsCount}석` : null
  const departureStatusText = [
    currentBookedCount != null ? `현재예약 ${currentBookedCount}명` : null,
    minimumDepartureCount != null ? `최소출발 ${minimumDepartureCount}명` : null,
    seatsStatusRaw,
  ]
    .filter(Boolean)
    .join(' · ')

  return {
    remainingSeatsCount,
    currentBookedCount,
    minimumDepartureCount,
    seatsStatusRaw,
    departureStatusText: departureStatusText || null,
  }
}

/** URL ProCode 출발일에 맞는 price row에서 잔여석 추출 */
export function resolveVerygoodRemainingSeatsFromPriceRows(
  proCode: string,
  priceRows: RegisterFactPriceRow[],
): { remainingSeatsCount: number | null; seatsStatusRaw: string | null } {
  const target = proCodeVariantToIsoYmd(proCode)
  const row =
    (target ? priceRows.find((r) => String(r.departureDate ?? '').slice(0, 10) === target) : null) ??
    priceRows[0] ??
    null
  if (!row) return { remainingSeatsCount: null, seatsStatusRaw: null }
  const seatCount = row.seatCount ?? null
  const seatsStatusRaw = row.seatsStatusRaw?.trim() || (seatCount != null ? `잔여${seatCount}` : null)
  return { remainingSeatsCount: seatCount, seatsStatusRaw }
}

export type VerygoodDetailOptionalShopping = {
  optionalToursStructured: string | null
  hasOptionalTour: boolean | null
  optionalTourCount: number | null
  optionalTourSummaryText: string | null
  shoppingStops: string | null
  shoppingVisitCount: number | null
  hasShopping: boolean | null
  shoppingSummaryText: string | null
}

function stripTdInnerHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function findVerygoodTableTbodyHtml(html: string, captionPattern: RegExp): string | null {
  const captionIdx = html.search(captionPattern)
  if (captionIdx < 0) return null
  const tableStart = html.lastIndexOf('<table', captionIdx)
  if (tableStart < 0) return null
  const tableChunk = html.slice(tableStart, tableStart + 80_000)
  const closeTable = tableChunk.search(/<\/table>/i)
  const tableHtml = closeTable > 0 ? tableChunk.slice(0, closeTable) : tableChunk
  const tbodyMatch = tableHtml.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i)
  return tbodyMatch?.[1] ?? null
}

function parseVerygoodHtmlTableBodyRows(tbodyHtml: string): string[][] {
  const rows: string[][] = []
  for (const trMatch of tbodyHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells: string[] = []
    for (const tdMatch of trMatch[1]!.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)) {
      cells.push(stripTdInnerHtml(tdMatch[1]!))
    }
    if (cells.some((c) => c.length > 0)) rows.push(cells)
  }
  return rows
}

function parseVerygoodUsdPriceCell(raw: string | null | undefined): number | null {
  const t = String(raw ?? '').trim()
  if (!t) return null
  const nums = [...t.matchAll(/\$\s*(\d{1,4})/g)]
    .map((m) => Number(m[1]))
    .filter((n) => Number.isFinite(n) && n >= 10)
  if (nums.length > 0) return Math.max(...nums)
  const loose = t.match(/(\d{2,4})/)
  return loose ? Number(loose[1]) : null
}

function parseVerygoodOptionalTourRowsFromDetailTable(html: string): StructuredOptionalTourRow[] {
  const tbody = findVerygoodTableTbodyHtml(html, /선택관광\s*리스트|선택관광리스트/i)
  if (!tbody) return []
  const tableRows = parseVerygoodHtmlTableBodyRows(tbody)
  const out: StructuredOptionalTourRow[] = []
  const gk = 'guide\u540c\u884cText' as const
  for (const cols of tableRows) {
    if (cols.length < 4) continue
    const num = cols[0]!.replace(/\s+/g, '')
    if (!/^\d+$/.test(num)) continue
    const name = cols[1]!.trim()
    if (!name || /^(번호|선택|관광명|비용|시간)$/i.test(name)) continue
    const description = cols[2]?.trim() ?? ''
    const priceCell = cols[3]?.trim() ?? ''
    const durationText = cols[4]?.trim() || null
    const waitingSchedule = cols[5]?.trim() || null
    const waitingPlace = cols[6]?.trim() || null
    const guideText = cols[7]?.trim() || null
    out.push({
      name,
      currency: /\$|USD/i.test(priceCell) ? '$' : null,
      adultPrice: parseVerygoodUsdPriceCell(priceCell),
      childPrice: null,
      durationText,
      minPaxText: null,
      waitingPlaceText: [waitingSchedule, waitingPlace].filter(Boolean).join(' · ') || null,
      raw: [num, name, description, priceCell, durationText].filter(Boolean).join('\t'),
      [gk]: guideText,
    })
  }
  return filterOptionalTourRows(out).slice(0, 8)
}

function parseVerygoodShoppingStopsFromDetailTable(html: string): StructuredShoppingStopRow[] {
  const tbody = findVerygoodTableTbodyHtml(html, /쇼핑\s*안내\s*리스트|쇼핑안내리스트/i)
  if (!tbody) return []
  const tableRows = parseVerygoodHtmlTableBodyRows(tbody)
  const out: StructuredShoppingStopRow[] = []
  for (const cols of tableRows) {
    if (cols.length < 3) continue
    const visitNo = cols[0]!.replace(/\s+/g, '')
    if (!/^\d+$/.test(visitNo)) continue
    const itemType = cols[1]!.trim()
    const placeName = cols[2]!.trim()
    if (!itemType && !placeName) continue
    if (/^(구분|쇼핑항목|쇼핑장소|소요시간|환불)/i.test(itemType)) continue
    out.push({
      itemType: itemType || '쇼핑',
      placeName: placeName || itemType,
      durationText: cols[3]?.trim() || null,
      refundPolicyText: cols[4]?.trim() || null,
      raw: cols.join('\t'),
    })
  }
  return out.slice(0, 15)
}

function htmlToVerygoodOptShopPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, '\t')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
}

function normalizeVerygoodOptShopLines(plain: string): string[] {
  return plain
    .split('\n')
    .map((line) =>
      line
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+/g, (m) => (m.includes('\t') ? '\t' : ' '))
        .replace(/\t+/g, '\t')
        .trim(),
    )
    .filter((line) => line.replace(/\t/g, '').trim().length > 0)
}

function extractVerygoodOptionalTourRowsFromFlat(flat: string): StructuredOptionalTourRow[] {
  const rows: StructuredOptionalTourRow[] = []
  const re =
    /(?:^|\s)(\d{1,2})\s+([가-힣A-Za-z0-9+]+(?:투어|나이트|마사지)?)\s+([^$]{4,160}?)\s+\$\s*(\d{1,4})\b/g
  for (const m of flat.matchAll(re)) {
    const name = m[2]!.trim()
    if (!name || /^(번호|선택|관광명|비용|시간)$/i.test(name)) continue
    rows.push({
      name,
      currency: '$',
      adultPrice: Number(m[4]),
      childPrice: null,
      durationText: null,
      minPaxText: null,
      waitingPlaceText: null,
      raw: m[0]!.trim(),
      ['guide\u540c\u884cText']: null,
    })
  }
  return filterOptionalTourRows(rows).slice(0, 8)
}

function extractVerygoodShoppingRowsFromFlat(flat: string): {
  shoppingVisitCount: number | null
  shoppingStops: StructuredShoppingStopRow[]
} {
  const shoppingVisitCount = parseInt(flat.match(/쇼핑\s*(?:횟수\s*)?(?:총\s*)?(\d+)\s*회/i)?.[1] ?? '', 10)
  const stops: StructuredShoppingStopRow[] = []
  const re =
    /(?:^|\s)(\d{1,2})\s+([가-힣A-Za-z0-9·/,()+\s]{2,80}?)\s+([가-힣A-Za-z0-9()·\s]{2,80})\s+(?:약)?(\d+\s*분(?:~\d+\s*분)?|\d+\s*시간(?:~\d+\s*시간)?)/g
  for (const m of flat.matchAll(re)) {
    const itemType = m[2]!.trim()
    const placeName = m[3]!.trim()
    if (/^(구분|쇼핑항목|쇼핑장소)/i.test(itemType)) continue
    stops.push({
      itemType,
      placeName,
      durationText: m[4]!.trim(),
      refundPolicyText: null,
      raw: m[0]!.trim(),
    })
  }
  return {
    shoppingVisitCount: Number.isFinite(shoppingVisitCount) && shoppingVisitCount > 0 ? shoppingVisitCount : null,
    shoppingStops: stops,
  }
}

function sliceVerygoodOptShopRegisterText(plain: string): string {
  const idxOpt = plain.search(/선택관광\s*리스트|선택관광리스트/i)
  const idxShop = plain.search(/쇼핑\s*안내\s*리스트|쇼핑안내리스트|쇼핑횟수/i)
  const start = idxOpt >= 0 ? idxOpt : idxShop >= 0 ? idxShop : 0
  const tail = plain.slice(start)
  const endMatch = tail.search(/여행자보험|고객상품평|Copyright|참좋은여행\(주\)/i)
  return (endMatch > 0 ? tail.slice(0, endMatch) : tail).slice(0, 12_000)
}

function verygoodOptionalRowsToRegisterJson(rows: StructuredOptionalTourRow[]): string {
  return buildOptionalToursStructuredForRegisterJson(
    rows.map((row) => ({
      tourName: row.name,
      currency: row.currency ?? '$',
      adultPrice: row.adultPrice,
      childPrice: row.childPrice,
      durationText: row.durationText ?? '',
      minPeopleText: row.minPaxText ?? '',
      guide\u540c\u884cText: row['guide\u540c\u884cText'] ?? '',
      waitingPlaceText: row.waitingPlaceText ?? '',
      descriptionText: row.raw,
    })),
    null,
  )
}

/** PackageDetail HTML 본문에서 선택관광·쇼핑 구조화 행 */
export function extractVerygoodOptionalShoppingFromDetailHtml(html: string): VerygoodDetailOptionalShopping {
  let optionalRows = parseVerygoodOptionalTourRowsFromDetailTable(html)

  const plain = htmlToVerygoodOptShopPlainText(html)
  const lines = normalizeVerygoodOptShopLines(plain)
  const slice = sliceVerygoodOptShopRegisterText(lines.join('\n'))
  const sliceLines = normalizeVerygoodOptShopLines(slice)
  const flat = slice.replace(/\s+/g, ' ')

  if (optionalRows.length === 0) {
    optionalRows = extractVerygoodOptionalTourRowsFromFlat(flat)
  }

  let shopping = extractVerygoodShoppingRowsFromFlat(flat)
  const tableShopping = parseVerygoodShoppingStopsFromDetailTable(html)
  if (tableShopping.length > 0) {
    shopping = { shoppingVisitCount: shopping.shoppingVisitCount, shoppingStops: tableShopping }
  }

  const signals = extractStructuredTourSignals(sliceLines.join('\n'))
  if (optionalRows.length === 0) optionalRows = signals.optionalTours
  if (shopping.shoppingStops.length === 0) {
    shopping = {
      shoppingVisitCount: shopping.shoppingVisitCount ?? signals.shoppingVisitCount,
      shoppingStops: signals.shoppingStops,
    }
  }
  const headerShoppingCount = parseInt(plain.match(/쇼핑\s*(\d+)\s*회/i)?.[1] ?? '', 10)
  const shoppingVisitCount =
    shopping.shoppingVisitCount ??
    signals.shoppingVisitCount ??
    (Number.isFinite(headerShoppingCount) && headerShoppingCount > 0 ? headerShoppingCount : null)
  const hasShopping =
    (shoppingVisitCount ?? 0) > 0 || shopping.shoppingStops.some((r) => r.placeName.trim().length > 1)
  const shoppingStopsFiltered = shopping.shoppingStops.filter(
    (r) => r.placeName.trim().length > 1 && !/^\d+˚$/.test(r.itemType.trim()),
  )
  const optionalToursStructured = optionalRows.length > 0 ? verygoodOptionalRowsToRegisterJson(optionalRows) : null
  const shoppingStops =
    shoppingStopsFiltered.length > 0 ? JSON.stringify(shoppingStopsFiltered) : signals.shoppingStopsJson
  const hasOptionalTour = optionalRows.length > 0 || signals.hasOptionalTour
  return {
    optionalToursStructured,
    hasOptionalTour,
    optionalTourCount: optionalRows.length > 0 ? optionalRows.length : hasOptionalTour ? signals.optionalTourCount : null,
    optionalTourSummaryText:
      optionalRows.length > 0
        ? optionalRows.length === 1
          ? '선택관광 1건'
          : `선택관광 ${optionalRows.length}건`
        : signals.optionalTourSummaryText || null,
    shoppingStops,
    shoppingVisitCount,
    hasShopping,
    shoppingSummaryText:
      shoppingVisitCount != null
        ? `쇼핑 ${shoppingVisitCount}회`
        : signals.shoppingSummaryText || null,
  }
}
