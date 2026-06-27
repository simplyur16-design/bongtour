/**
 * 내일투어 등록 상세 — view.asp + view_process.asp(tab0/tab1) SSOT.
 * REGRESSION-FREEZE[naeiltour-register-api-detail]: tab0·tab1·잔여석·항공 — manifest
 */
import type { FlightStructured } from '@/lib/detail-body-parser-types'
import { createEmptyFlightLeg } from '@/lib/flight-parser-generic'
import type { RegisterFactScheduleDay } from '@/lib/register-facts/types'
import {
  fetchNaeiltourText,
  fetchNaeiltourViewTabHtml,
  hiddenInputsFromHtml,
  NAEILTOUR_BASE,
  parseNaeiltourGoodCdFromUrl,
} from '@/lib/naeiltour-http'
import { parseFactMealsListToScheduleFields } from '@/lib/register-schedule-meal-parse'
import {
  dedupeNaeiltourScheduleRoutePlaces,
  joinNaeiltourScheduleRouteText,
} from '@/lib/naeiltour-register-api-schedule'

const NAEILTOUR_REGISTER_DETAIL_PACE_MS = 280

export type NaeiltourRegisterDetailBundle = {
  originUrl: string
  referer: string
  pageHtml: string
  tab0Html: string | null
  tab1Html: string | null
  goodCd: string
  eventSeq: string | null
  hidden: Record<string, string>
}

export type NaeiltourParsedScheduleDay = RegisterFactScheduleDay & {
  englishRouteLandmarks: string[]
  dateIso: string | null
}

function pace(): Promise<void> {
  return new Promise((r) => setTimeout(r, NAEILTOUR_REGISTER_DETAIL_PACE_MS))
}

export function stripNaeiltourHtmlText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&middot;/gi, '·')
    .replace(/\s+/g, ' ')
    .trim()
}

function bulletsFromBlockHtml(raw: string | null | undefined): string[] {
  const text = String(raw ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
  return text
    .split(/\n/)
    .map((line) =>
      line
        .replace(/^[\s·▪▶●\-–—ㄴ]+/, '')
        .replace(/<[^>]+>/g, ' ')
        .trim(),
    )
    .filter((line) => line.length > 2 && line.length < 500)
}

function extractIncluExcluBlock(html: string, titleLabel: string): string | null {
  const re = new RegExp(
    `<p class="title">\\s*${titleLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</p>\\s*<div class="cont">([\\s\\S]*?)</div>`,
    'i',
  )
  return html.match(re)?.[1] ?? null
}

export function extractNaeiltourIncludedExcludedFromTab0(html: string | null): {
  includedItems: string[]
  excludedItems: string[]
} {
  if (!html) return { includedItems: [], excludedItems: [] }
  return {
    includedItems: bulletsFromBlockHtml(extractIncluExcluBlock(html, '포함사항')).slice(0, 32),
    excludedItems: bulletsFromBlockHtml(extractIncluExcluBlock(html, '불포함사항')).slice(0, 32),
  }
}

export function extractNaeiltourOptionalShoppingFromTab0(html: string | null): {
  hasOptionalTour: boolean
  optionalTourSummaryText: string | null
  hasShopping: boolean
  shoppingSummaryText: string | null
  shoppingVisitCount: number | null
} {
  if (!html) {
    return {
      hasOptionalTour: false,
      optionalTourSummaryText: null,
      hasShopping: false,
      shoppingSummaryText: null,
      shoppingVisitCount: null,
    }
  }
  const optRaw = stripNaeiltourHtmlText(extractIncluExcluBlock(html, '선택관광') ?? '')
  const shopRaw = stripNaeiltourHtmlText(extractIncluExcluBlock(html, '쇼핑정보') ?? '')
  const noOption = /노옵션|선택관광이\s*없/i.test(optRaw)
  const hasOptionalTour = Boolean(optRaw) && !noOption
  const hasShopping = Boolean(shopRaw) && !/쇼핑\s*없|노쇼핑/i.test(shopRaw)
  const shopHours = shopRaw.match(/약\s*(\d+)\s*시간/)
  return {
    hasOptionalTour,
    optionalTourSummaryText: optRaw || null,
    hasShopping,
    shoppingSummaryText: shopRaw || null,
    shoppingVisitCount: hasShopping ? (shopHours ? 1 : 1) : noOption ? 0 : null,
  }
}

export function extractNaeiltourTitleFromPage(html: string): string | null {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
  if (og?.trim()) return stripNaeiltourHtmlText(og)
  const h = html.match(/<h2[^>]*class=["'][^"']*tit[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i)?.[1]
  if (h?.trim()) return stripNaeiltourHtmlText(h).slice(0, 200)
  const t = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]
  return t ? stripNaeiltourHtmlText(t).replace(/\s*[-|]\s*내일투어.*/i, '').trim() : null
}

export function extractNaeiltourDurationFromText(text: string): { nights: number | null; days: number | null } {
  const m = text.match(/(\d+)\s*박\s*(\d+)\s*일/)
  if (!m) return { nights: null, days: null }
  const nights = Number(m[1])
  const days = Number(m[2])
  return {
    nights: Number.isFinite(nights) ? nights : null,
    days: Number.isFinite(days) ? days : null,
  }
}

export function extractNaeiltourSeatsFromPage(html: string): {
  remainingSeatsCount: number | null
  seatsStatusRaw: string | null
  minimumDepartureCount: number | null
  currentBookedCount: number | null
} {
  const flat = stripNaeiltourHtmlText(html)
  let remainingSeatsCount: number | null = null
  let minimumDepartureCount: number | null = null
  let currentBookedCount: number | null = null
  let seatsStatusRaw: string | null = null

  const rem =
    flat.match(/잔여\s*(\d+)\s*(?:석|명)/) ??
    flat.match(/남은\s*좌석\s*[:：]?\s*(\d+)/) ??
    flat.match(/잔여석\s*(\d+)/) ??
    flat.match(/예약\s*가능\s*(\d+)\s*(?:석|명)/) ??
    flat.match(/모집\s*(\d+)\s*(?:석|명)/)
  if (rem?.[1]) {
    remainingSeatsCount = Number(rem[1])
    seatsStatusRaw = rem[0] ?? null
  }

  const min =
    flat.match(/최소\s*출발\s*인원\s*(\d+)\s*명/) ??
    flat.match(/최소출발\s*(\d+)\s*명/) ??
    flat.match(/최소\s*출발\s*(\d+)\s*명/)
  if (min?.[1]) minimumDepartureCount = Number(min[1])

  const booked = flat.match(/현재\s*예약\s*[:：]?\s*(\d+)\s*명/)
  if (booked?.[1]) currentBookedCount = Number(booked[1])

  return { remainingSeatsCount, seatsStatusRaw, minimumDepartureCount, currentBookedCount }
}

function normalizeFlightNo(raw: string | null | undefined): string | null {
  const m = String(raw ?? '').match(/\b([A-Z]{2})\s*(\d{3,4})\b/i)
  return m ? `${m[1]!.toUpperCase()}${m[2]!}` : null
}

function parseNaeiltourKoreanDateToIso(s: string | null | undefined): string | null {
  const m = String(s ?? '').match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/)
  if (!m) return null
  return `${m[1]}-${m[2]!.padStart(2, '0')}-${m[3]!.padStart(2, '0')}`
}

type NaeiltourFlightScheduleEntry = {
  dateText: string | null
  dateIso: string | null
  depTime: string | null
  arrTime: string | null
  flightNo: string | null
  raw: string
  hasDepartureKeyword: boolean
  hasArrivalKeyword: boolean
  mentionsKoreaAirport: boolean
}

function extractNaeiltourAirlineFromHtml(hay: string, flat: string): string | null {
  const block = hay.match(/class=["']airline["'][^>]*>([\s\S]*?)<\/(?:div|section|article)>/i)?.[1]
  if (block) {
    let name = stripNaeiltourHtmlText(block).replace(/^항공사\s*/i, '').trim()
    name = name.split(/항공\s*여정/i)[0]?.trim() ?? name
    const short = name.match(/^([가-힣A-Za-z]+항공)/)?.[1] ?? name
    if (short && short !== '항공사' && /항공/i.test(short)) return short.slice(0, 40)
  }
  const known =
    flat.match(
      /(?:아시아나|대한항공|진에어|티웨이|에어부산|이스타|제주항공|싱가폴항공|카타르(?:항공)?|에미레이트(?:항공)?|루프트한자|에어프랑스|영국항공|델타(?:항공)?|유나이티드(?:항공)?|일본항공|ANA|JAL)/i,
    )?.[0] ?? null
  if (known) return known.replace(/\s+/g, '').slice(0, 40)
  const line = flat.match(/(?:^|\s)([가-힣A-Za-z]{2,14}항공)(?:\s|$)/m)?.[1]
  if (line && line !== '항공사') return line
  return null
}

function pushUniqueFlightEntry(
  out: NaeiltourFlightScheduleEntry[],
  entry: NaeiltourFlightScheduleEntry,
): void {
  const key = `${entry.flightNo ?? ''}|${entry.dateIso ?? entry.dateText ?? ''}|${entry.depTime ?? ''}`
  if (out.some((e) => `${e.flightNo ?? ''}|${e.dateIso ?? e.dateText ?? ''}|${e.depTime ?? ''}` === key)) {
    return
  }
  out.push(entry)
}

function scanNaeiltourFlightScheduleEntries(hay: string, flat: string): NaeiltourFlightScheduleEntry[] {
  const out: NaeiltourFlightScheduleEntry[] = []

  for (const m of hay.matchAll(
    /<strong>\s*(\d{4}년\s*\d{1,2}월\s*\d{1,2}일(?:\([^)]*\))?)\s*<\/strong>\s*\[(\d{1,2}:\d{2})(?:~(\d{1,2}:\d{2}))?\]\s*-\s*([A-Z]{2}\d{3,4})/gi,
  )) {
    const raw = stripNaeiltourHtmlText(m[0] ?? '')
    pushUniqueFlightEntry(out, {
      dateText: m[1]!.trim(),
      dateIso: parseNaeiltourKoreanDateToIso(m[1]!),
      depTime: m[2]!.trim(),
      arrTime: m[3]?.trim() ?? null,
      flightNo: normalizeFlightNo(m[4]!),
      raw,
      hasDepartureKeyword: /출발/.test(raw),
      hasArrivalKeyword: /도착/.test(raw),
      mentionsKoreaAirport: /인천|김포|ICN|GMP/i.test(raw),
    })
  }

  for (const m of flat.matchAll(
    /(\d{4}년\s*\d{1,2}월\s*\d{1,2}일(?:\([^)]*\))?)\s*\[(\d{1,2}:\d{2})(?:~(\d{1,2}:\d{2}))?\]\s*-\s*([A-Z]{2}\d{3,4})/gi,
  )) {
    const raw = m[0]!.trim()
    pushUniqueFlightEntry(out, {
      dateText: m[1]!.trim(),
      dateIso: parseNaeiltourKoreanDateToIso(m[1]!),
      depTime: m[2]!.trim(),
      arrTime: m[3]?.trim() ?? null,
      flightNo: normalizeFlightNo(m[4]!),
      raw,
      hasDepartureKeyword: /출발/.test(raw),
      hasArrivalKeyword: /도착/.test(raw),
      mentionsKoreaAirport: /인천|김포|ICN|GMP/i.test(raw),
    })
  }

  for (const m of hay.matchAll(/\[(\d{1,2}:\d{2})\]\s*([A-Z]{2}\s*\d{3,4})[^\n<]{0,120}(?:출발|도착)/gi)) {
    const raw = stripNaeiltourHtmlText(m[0] ?? '')
    pushUniqueFlightEntry(out, {
      dateText: null,
      dateIso: null,
      depTime: m[1]!.trim(),
      arrTime: null,
      flightNo: normalizeFlightNo(m[2]!),
      raw,
      hasDepartureKeyword: /출발/.test(raw),
      hasArrivalKeyword: /도착/.test(raw),
      mentionsKoreaAirport: /인천|김포|ICN|GMP/i.test(raw),
    })
  }

  if (!out.length) {
    for (const m of hay.matchAll(/\[(\d{1,2}:\d{2})(?:~(\d{1,2}:\d{2}))?\]\s*-\s*([A-Z]{2}\d{3,4})/gi)) {
      const raw = stripNaeiltourHtmlText(m[0] ?? '')
      pushUniqueFlightEntry(out, {
        dateText: null,
        dateIso: null,
        depTime: m[1]!.trim(),
        arrTime: m[2]?.trim() ?? null,
        flightNo: normalizeFlightNo(m[3]!),
        raw,
        hasDepartureKeyword: false,
        hasArrivalKeyword: false,
        mentionsKoreaAirport: false,
      })
    }
  }

  return out
}

function parseFlightLegFromLine(line: string): Partial<ReturnType<typeof createEmptyFlightLeg>> {
  const leg: Partial<ReturnType<typeof createEmptyFlightLeg>> = {}
  const fn = normalizeFlightNo(line)
  if (fn) leg.flightNo = fn
  const timeRange = line.match(/\[(\d{1,2}:\d{2})(?:~(\d{1,2}:\d{2}))?\]/)
  const time = timeRange ?? line.match(/\[(\d{1,2}:\d{2})\]/)
  if (time?.[1]) {
    if (/출발/.test(line) || !leg.departureTime) leg.departureTime = time[1]
    if (timeRange?.[2]) leg.arrivalTime = timeRange[2]
    if (/도착/.test(line)) leg.arrivalTime = time[1]
  }
  const airport =
    line.match(/(\d{1,2}:\d{2})\s+(.+?)\s+(?:국제)?\s*공항?\s*(출발|도착)/) ??
    line.match(/(.+?)\s+(?:국제)?\s*공항?\s*(출발|도착)/)
  if (airport) {
    const place = (airport[2] ?? airport[1] ?? '').trim()
    if (airport[3] === '출발' || /출발/.test(line)) leg.departureAirport = place
    if (airport[3] === '도착' || /도착/.test(line)) leg.arrivalAirport = place
  }
  return leg
}

export function buildNaeiltourFlightStructuredFromHtml(
  pageHtml: string,
  tab0Html: string | null,
  tab1Html: string | null,
): FlightStructured | null {
  const hay = [pageHtml, tab0Html, tab1Html].filter(Boolean).join('\n')
  const flat = stripNaeiltourHtmlText(hay)
  const airline = extractNaeiltourAirlineFromHtml(hay, flat)

  const scheduleEntries = scanNaeiltourFlightScheduleEntries(hay, flat)
  const flightLines = scheduleEntries.map((e) => ({
    time: e.depTime ?? '',
    fn: e.flightNo,
    raw: e.raw,
    entry: e,
  }))

  const outbound = createEmptyFlightLeg()
  const inbound = createEmptyFlightLeg()

  const obLine =
    flightLines.find((l) => l.entry.hasDepartureKeyword && l.entry.mentionsKoreaAirport) ??
    flightLines.find((l) => l.entry.mentionsKoreaAirport && /출발/.test(l.raw)) ??
    flightLines[0]
  const ibLine =
    [...flightLines]
      .reverse()
      .find((l) => l.entry.hasDepartureKeyword && !l.entry.mentionsKoreaAirport) ??
    [...flightLines].reverse().find((l) => /출발/.test(l.raw) && !/인천|김포|ICN|GMP/i.test(l.raw)) ??
    (flightLines.length >= 2 ? flightLines[flightLines.length - 1] : undefined)

  if (obLine) {
    Object.assign(outbound, parseFlightLegFromLine(obLine.raw))
    if (!outbound.flightNo && obLine.fn) outbound.flightNo = obLine.fn
    if (!outbound.departureTime && obLine.entry.depTime) outbound.departureTime = obLine.entry.depTime
    if (!outbound.arrivalTime && obLine.entry.arrTime) outbound.arrivalTime = obLine.entry.arrTime
    if (!outbound.departureDate && obLine.entry.dateIso) outbound.departureDate = obLine.entry.dateIso
  }
  if (ibLine && ibLine !== obLine) {
    Object.assign(inbound, parseFlightLegFromLine(ibLine.raw))
    if (!inbound.flightNo && ibLine.fn) inbound.flightNo = ibLine.fn
    if (!inbound.departureTime && ibLine.entry.depTime) inbound.departureTime = ibLine.entry.depTime
    if (!inbound.arrivalTime && ibLine.entry.arrTime) inbound.arrivalTime = ibLine.entry.arrTime
    if (!inbound.departureDate && ibLine.entry.dateIso) inbound.departureDate = ibLine.entry.dateIso
  }

  const arriveLine = flightLines.find((l) => l.entry.hasArrivalKeyword && l.entry.mentionsKoreaAirport)
  if (arriveLine) {
    if (!inbound.arrivalTime && arriveLine.entry.depTime) inbound.arrivalTime = arriveLine.entry.depTime
    if (!inbound.flightNo && arriveLine.fn) inbound.flightNo = arriveLine.fn
    if (!inbound.arrivalDate && arriveLine.entry.dateIso) inbound.arrivalDate = arriveLine.entry.dateIso
  }

  const dateInHeader =
    tab1Html?.match(/1일차[\s\S]*?<strong>\s*(\d{4}\/\d{1,2}\/\d{1,2})/i)?.[1] ??
    tab1Html?.match(/(\d{4}\/\d{1,2}\/\d{1,2})\([^)]*\)/)?.[1]
  if (dateInHeader && !outbound.departureDate) {
    outbound.departureDate = dateInHeader.replace(/\//g, '-').slice(0, 10)
  }

  const lastDayMatch = tab1Html?.match(/(\d+)일차[\s\S]*?<strong>\s*(\d{4}\/\d{1,2}\/\d{1,2})/gi)
  if (lastDayMatch?.length) {
    const last = lastDayMatch[lastDayMatch.length - 1]!
    const d = last.match(/(\d{4}\/\d{1,2}\/\d{1,2})/)?.[1]
    if (d && !inbound.arrivalDate) inbound.arrivalDate = d.replace(/\//g, '-').slice(0, 10)
  }

  if (!outbound.flightNo && !inbound.flightNo && !airline) return null
  const hasCore =
    Boolean(outbound.flightNo?.trim() || inbound.flightNo?.trim()) &&
    Boolean(
      (outbound.departureTime?.trim() || outbound.flightNo?.trim()) &&
        (inbound.departureTime?.trim() || inbound.flightNo?.trim()),
    )
  return {
    airlineName: airline,
    outbound,
    inbound,
    rawFlightLines: flightLines.map((l) => l.raw).filter(Boolean).slice(0, 20),
    debug: {
      candidateCount: flightLines.length,
      selectedOutRaw: obLine?.raw ?? null,
      selectedInRaw: ibLine?.raw ?? null,
      partialStructured: !hasCore,
      status: hasCore ? 'success' : 'partial',
      exposurePolicy: 'admin_only',
      supplierBrandKey: 'naeiltour',
      expectFlightNumber: true,
    },
    reviewNeeded: !hasCore,
    reviewReasons: hasCore ? [] : ['내일투어 항공 추출 불완전'],
  }
}

function extractMealsFromBlock(block: string): string[] {
  const m = block.match(/\[(조식|중식|석식)[^\]]*\][^\n]*/g)
  return m?.map((x) => stripNaeiltourHtmlText(x)) ?? []
}

function extractHotelFromBlock(block: string): string | null {
  const stay = block.match(/<div class="stay">([\s\S]*?)<\/div>/i)?.[1]
  if (!stay) return null
  const t = stripNaeiltourHtmlText(stay).replace(/^숙박\s*/, '').trim()
  return t || null
}

function extractEnglishLandmarksFromBlock(block: string): string[] {
  const out: string[] = []
  for (const m of block.matchAll(/<h3>[^<]*<span>([^<]+)<\/span>/gi)) {
    const en = String(m[1] ?? '').trim()
    if (en && /[A-Za-z]/.test(en) && en.length >= 3) out.push(en)
  }
  return out.slice(0, 7)
}

function parseDateIsoFromStrong(strongText: string): string | null {
  const m = strongText.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/)
  if (!m) return null
  return `${m[1]}-${m[2]!.padStart(2, '0')}-${m[3]!.padStart(2, '0')}`
}

export function parseNaeiltourScheduleDaysFromTab1(html: string | null): NaeiltourParsedScheduleDay[] {
  if (!html?.trim()) return []
  const days: NaeiltourParsedScheduleDay[] = []
  const chunks = html.split(/<div class="schedule_wrap">/i).slice(1)
  for (const chunk of chunks) {
    const header = chunk.match(/(\d+)일차[\s\S]*?<strong>\s*([^<]+?)\s*<\/strong>/i)
    if (!header?.[1] || !header[2]) continue
    const day = Number(header[1])
    if (!Number.isFinite(day) || day <= 0) continue
    const strongText = stripNaeiltourHtmlText(header[2]!)
    const dateIso = parseDateIsoFromStrong(strongText)
    const routeRaw = strongText.replace(/^\d{4}\/\d{1,2}\/\d{1,2}\([^)]*\)\s*/, '').trim()
    const places = dedupeNaeiltourScheduleRoutePlaces(
      routeRaw
        .split(/-/)
        .map((s) => s.trim())
        .filter(Boolean),
    ).slice(0, 7)
    const englishRouteLandmarks = extractEnglishLandmarksFromBlock(chunk)
    const meals = extractMealsFromBlock(chunk)
    const hotel = extractHotelFromBlock(chunk)
    const transportNote = joinNaeiltourScheduleRouteText(places)
    days.push({
      day,
      places,
      hotels: hotel ? [hotel] : [],
      meals,
      transportNote,
      englishRouteLandmarks,
      dateIso,
    })
  }
  return days.sort((a, b) => a.day - b.day)
}

export function parseNaeiltourEventSeqFromHtml(html: string): string | null {
  return (
    html.match(/name=["']event_seq["'][^>]*value=["']([^"']+)["']/i)?.[1]?.trim() ??
    html.match(/value=["']([^"']+)["'][^>]*name=["']event_seq["']/i)?.[1]?.trim() ??
    hiddenInputsFromHtml(html).event_seq?.trim() ??
    null
  )
}

export async function fetchNaeiltourRegisterDetailBundle(originUrl: string): Promise<NaeiltourRegisterDetailBundle | null> {
  const url = originUrl.trim()
  const goodCd = parseNaeiltourGoodCdFromUrl(url)
  if (!url || !goodCd || !/naeiltour\.co\.kr/i.test(url)) return null

  const referer = url.includes('#') ? url : `${url}${url.includes('?') ? '' : '?'}`
  const pageHtml = await fetchNaeiltourText(url.split('#')[0]!, {
    headers: { referer: NAEILTOUR_BASE },
    signal: AbortSignal.timeout(45_000),
  }).catch(() => null)
  if (!pageHtml) return null

  await pace()
  const tab0Html = await fetchNaeiltourViewTabHtml(pageHtml, 0, referer).catch(() => null)
  await pace()
  const tab1Html = await fetchNaeiltourViewTabHtml(pageHtml, 1, referer).catch(() => null)

  const hidden = hiddenInputsFromHtml(pageHtml)
  return {
    originUrl: url,
    referer,
    pageHtml,
    tab0Html,
    tab1Html,
    goodCd: hidden.good_cd?.trim() || goodCd,
    eventSeq: parseNaeiltourEventSeqFromHtml(pageHtml),
    hidden,
  }
}

export function naeiltourParsedScheduleToFactDays(days: NaeiltourParsedScheduleDay[]): RegisterFactScheduleDay[] {
  return days.map(({ englishRouteLandmarks: _e, dateIso: _d, ...rest }) => rest)
}

export function naeiltourScheduleEnglishLandmarksByDay(
  days: NaeiltourParsedScheduleDay[],
): Map<number, string[]> {
  return new Map(days.map((d) => [d.day, d.englishRouteLandmarks]))
}

export { parseFactMealsListToScheduleFields }
