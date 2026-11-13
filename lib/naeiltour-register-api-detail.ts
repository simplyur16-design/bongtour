/**
 * 내일투어 등록 상세 — view.asp + view_process.asp(tab0/tab1) SSOT.
 * REGRESSION-FREEZE[naeiltour-register-api-detail]: tab0·tab1·잔여석·항공 — manifest
 * REGRESSION-FREEZE[register-pre-photo-naeiltour-unsellable-no-stub]: 판매불가 alert는 상세 수집 중단 — manifest
 * REGRESSION-FREEZE[naeiltour-schedule-hotel-meal-extract]: stay 호텔·조식 본문 추출 — manifest
 */

/** 내일투어 상세가 판매 종료·미판매 알림만 주는 페이지인지. */
// REGRESSION-FREEZE[register-pre-photo-naeiltour-unsellable-no-stub]: 판매불가 alert — manifest
export function naeiltourDetailHtmlLooksUnsellable(html: string | null | undefined): boolean {
  const t = String(html ?? '')
  return /판매가\s*되지\s*않는\s*상품|판매가\s*종료된\s*상품|존재하지\s*않는\s*상품/i.test(t)
}
import {
  airlineKoFromIata,
  iataFromSupplierAirlineName,
  iataPrefixFromFlightNo,
} from '@/lib/departure-airline-display'
import type { FlightStructured } from '@/lib/detail-body-parser-types'
import { createEmptyFlightLeg } from '@/lib/flight-parser-generic'
import type { RegisterFactScheduleDay } from '@/lib/register-facts/types'
import {
  fetchNaeiltourTextResult,
  fetchNaeiltourViewTabHtmlResult,
  hiddenInputsFromHtml,
  NAEILTOUR_BASE,
  NAEILTOUR_VIEW_PAGE_TIMEOUT_MS,
  parseNaeiltourGoodCdFromUrl,
  type NaeiltourTextFetchResult,
} from '@/lib/naeiltour-http'
import type { SupplierFetchErrorKind } from '@/lib/supplier-http/supplier-fetch'
import { parseFactMealsListToScheduleFields } from '@/lib/register-schedule-meal-parse'
import {
  dedupeNaeiltourScheduleRoutePlaces,
  joinNaeiltourScheduleRouteText,
} from '@/lib/naeiltour-register-api-schedule'

const NAEILTOUR_REGISTER_DETAIL_PACE_MS = 280

export type NaeiltourDetailFetchPart = 'page' | 'tab0' | 'tab1'

export type NaeiltourDetailFetchError = {
  part: NaeiltourDetailFetchPart
  errorKind: SupplierFetchErrorKind
  status: number | null
  attempts: number
  elapsedMs: number
  url: string
}

export type NaeiltourDetailFetchStatus = {
  page: 'ok' | 'failed'
  tab0: 'ok' | 'failed'
  tab1: 'ok' | 'failed'
}

export type NaeiltourRegisterDetailBundle = {
  originUrl: string
  referer: string
  pageHtml: string
  tab0Html: string | null
  tab1Html: string | null
  goodCd: string
  eventSeq: string | null
  hidden: Record<string, string>
  fetchStatus: NaeiltourDetailFetchStatus
  fetchErrors: NaeiltourDetailFetchError[]
}

/** ok=3구간 모두 성공, partial=탭 일부 실패, page_failed=view.asp 실패, unsellable=판매불가 응답. */
export type NaeiltourRegisterDetailFetchOutcome = {
  outcome: 'ok' | 'partial' | 'page_failed' | 'unsellable' | 'invalid_url'
  bundle: NaeiltourRegisterDetailBundle | null
  fetchErrors: NaeiltourDetailFetchError[]
}

/** 선택관광 수집 상태 — tab0 실패면 「없음」으로 지어내지 않는다. */
export type NaeiltourOptionalTourCollectStatus = 'known' | 'unknown_not_found' | 'unknown_fetch_failed'

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

/** 1인실·가이드/기사 경비·비자 — 포함/불포함 불릿에서 추출
 * REGRESSION-FREEZE[naeiltour-fee-extract]: 1인실·가이드비 불릿 — manifest
 */
export type NaeiltourFeeExtract = {
  singleRoomSurchargeRaw: string | null
  singleRoomSurchargeAmount: number | null
  guideTipRaw: string | null
  mandatoryLocalFee: number | null
  mandatoryCurrency: string | null
  visaNoteRaw: string | null
}

export function extractNaeiltourFeesFromBullets(
  includedItems: readonly string[],
  excludedItems: readonly string[],
): NaeiltourFeeExtract {
  const lines = [...excludedItems, ...includedItems]
  let singleRoomSurchargeRaw: string | null = null
  let singleRoomSurchargeAmount: number | null = null
  let guideTipRaw: string | null = null
  let mandatoryLocalFee: number | null = null
  let mandatoryCurrency: string | null = null
  let visaNoteRaw: string | null = null

  for (const line of lines) {
    const t = String(line ?? '').trim()
    if (!t) continue
    if (!singleRoomSurchargeRaw && /(싱글|1인\s*객실|싱글룸|써차지|룸\s*차지|객실\s*추가)/i.test(t)) {
      singleRoomSurchargeRaw = t
      const m = t.match(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})\s*원/)
      if (m) singleRoomSurchargeAmount = Number(m[1]!.replace(/,/g, ''))
    }
    if (
      !guideTipRaw &&
      /(가이드\s*경비|기사\s*경비|인솔자\s*경비|매너팁|가이드\s*\/\s*기사|현지\s*필수\s*경비)/i.test(t)
    ) {
      guideTipRaw = t
      const usd = t.match(/(?:USD|\$)\s*([0-9]+(?:\.[0-9]+)?)/i) ?? t.match(/([0-9]+)\s*(?:USD|달러)/i)
      const krw = t.match(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})\s*원/)
      if (usd?.[1]) {
        mandatoryLocalFee = Number(usd[1])
        mandatoryCurrency = 'USD'
      } else if (krw?.[1]) {
        mandatoryLocalFee = Number(krw[1].replace(/,/g, ''))
        mandatoryCurrency = 'KRW'
      }
    }
    if (!visaNoteRaw && /(비자|출국세|E-비자)/i.test(t)) visaNoteRaw = t
  }

  return {
    singleRoomSurchargeRaw,
    singleRoomSurchargeAmount,
    guideTipRaw,
    mandatoryLocalFee,
    mandatoryCurrency,
    visaNoteRaw,
  }
}

export function extractNaeiltourOptionalShoppingFromTab0(html: string | null): {
  hasOptionalTour: boolean | null
  optionalTourSummaryText: string | null
  hasShopping: boolean | null
  shoppingSummaryText: string | null
  shoppingVisitCount: number | null
} {
  if (!html) {
    // 탭 HTML 미수신 → unknown (없음으로 발명 금지)
    return {
      hasOptionalTour: null,
      optionalTourSummaryText: null,
      hasShopping: null,
      shoppingSummaryText: null,
      shoppingVisitCount: null,
    }
  }
  const optRaw = stripNaeiltourHtmlText(extractIncluExcluBlock(html, '선택관광') ?? '')
  const shopRaw = stripNaeiltourHtmlText(extractIncluExcluBlock(html, '쇼핑정보') ?? '')
  const noOption = /노옵션|선택관광이\s*없/i.test(optRaw)
  const hasOptionalTour: boolean | null = !optRaw ? null : !noOption
  const noShopping = /쇼핑\s*없|노쇼핑|쇼핑없음/i.test(shopRaw)
  // 쇼핑정보 블록 없음 → unknown; 블록+없음 시그널 → false; 블록+내용 → true
  const hasShopping: boolean | null = !shopRaw ? null : noShopping ? false : true
  const countM = shopRaw.match(/쇼핑\s*(\d+)\s*회|총\s*(\d+)\s*회/)
  const countFromText =
    countM != null ? Number(countM[1] || countM[2]) : null
  let shoppingVisitCount: number | null = null
  if (hasShopping === true) {
    shoppingVisitCount =
      countFromText != null && Number.isFinite(countFromText) && countFromText >= 0
        ? countFromText
        : 1
  } else if (hasShopping === false) {
    // 쇼핑정보 블록이 있고 없음 시그널 → 0 (명시 없음)
    shoppingVisitCount = 0
  }
  return {
    hasOptionalTour,
    optionalTourSummaryText: optRaw || null,
    hasShopping,
    shoppingSummaryText: shopRaw || null,
    shoppingVisitCount,
  }
}

// REGRESSION-FREEZE[naeiltour-fetch-resilience]: tab0 수집 실패 → unknown_fetch_failed (없음 발명 금지) — manifest
export function resolveNaeiltourOptionalTourCollectStatus(
  bundle: Pick<NaeiltourRegisterDetailBundle, 'fetchStatus' | 'tab0Html'> | null,
): NaeiltourOptionalTourCollectStatus {
  if (!bundle || bundle.fetchStatus.tab0 !== 'ok') return 'unknown_fetch_failed'
  return extractNaeiltourOptionalShoppingFromTab0(bundle.tab0Html).hasOptionalTour == null
    ? 'unknown_not_found'
    : 'known'
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

/**
 * 내일투어 항공사명 — 항공 구역만 본다.
 * 이전 버그(10/31): `class="airline"` 블록의 '에어프랑스'처럼 '항공'이 안 붙은 이름을 버리고 **페이지 전체**에서
 * 처음 나온 항공사명을 잡아, 상단 메뉴의 '카타르'가 항공사로 저장됨(내일투어 68개 중 24개).
 * 지금: ① airline 블록 이름(원문 그대로) ② 블록 아이콘(`images/AF.gif`)·편명 IATA 접두로 판별 —
 * 이름의 코드가 편명 코드와 어긋나면 편명 코드 항공사 ③ 블록이 없으면 편명 앞뒤 구간에서만 이름 검색, 없으면 편명 코드 항공사.
 * 페이지 전체 단어 매칭은 하지 않는다.
 * REGRESSION-FREEZE[naeiltour-airline-flight-region-iata]: 항공 구역 한정 + IATA 접두 판별 — vitest
 */
function extractNaeiltourAirlineFromHtml(
  hay: string,
  flat: string,
  flightNos: ReadonlyArray<string | null | undefined> = [],
): string | null {
  const prefixes = flightNos.map((f) => iataPrefixFromFlightNo(f)).filter((x): x is string => Boolean(x))
  const flightCode = prefixes[0] ?? null
  const blockMatch = hay.match(/class=["']airline["'][^>]*>([\s\S]*?)<\/(?:div|section|article)>/i)
  const block = blockMatch?.[1] ?? null
  const iconCode = block?.match(/images\/([A-Z0-9]{2})\.(?:gif|png|jpe?g|svg)/i)?.[1]?.toUpperCase() ?? null
  const code = flightCode ?? iconCode
  const byCode = (c: string | null): string | null => (c ? airlineKoFromIata(c) : null)
  const reconcile = (name: string): string => {
    const nameCode = iataFromSupplierAirlineName(name)
    if (code && nameCode && nameCode !== code && !prefixes.includes(nameCode)) return byCode(code) ?? name
    return name
  }
  if (block) {
    let name = stripNaeiltourHtmlText(block.replace(/<!--[\s\S]*?-->/g, ' ')).replace(/^항공사\s*/i, '').trim()
    name = name.split(/항공\s*여정/i)[0]?.trim() ?? name
    name = name.replace(/\s+/g, ' ').trim()
    if (name && name !== '항공사' && /[가-힣]{2,}|^[A-Za-z][A-Za-z .'-]{2,}$/.test(name)) return reconcile(name).slice(0, 40)
    const fromIcon = byCode(code)
    if (fromIcon) return fromIcon
  }
  // 블록 없음: 편명이 나온 자리 앞뒤(±80자)에서만 항공사명 검색
  const nameRe =
    /(아시아나(?:항공)?|대한항공|진에어|티웨이(?:항공)?|에어부산|에어서울|이스타(?:항공)?|제주(?:항공|에어)|에어프레미아|싱가(?:폴|포르)항공|카타르(?:항공)?|에미레이트(?:항공)?|루프트한자|에어프랑스|영국항공|델타(?:항공)?|유나이티드(?:항공)?|일본항공|홍콩(?:항공|에어라인|익스프레스)|에어마카오|[가-힣]{2,10}항공)/
  for (const m of flat.matchAll(/\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?\d{3,4}\b/g)) {
    const at = m.index ?? 0
    const win = flat.slice(Math.max(0, at - 80), at + 80)
    const hit = win.match(nameRe)?.[1]
    if (hit && hit !== '항공사') return reconcile(hit.replace(/\s+/g, '')).slice(0, 40)
  }
  return byCode(code)
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
  const scheduleEntries = scanNaeiltourFlightScheduleEntries(hay, flat)
  const airline = extractNaeiltourAirlineFromHtml(
    hay,
    flat,
    scheduleEntries.map((e) => e.flightNo),
  )
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
  const bracket = block.match(/\[(조식|중식|석식)[^\]]*\][^\n]*/g)
  if (bracket?.length) {
    return bracket.map((x) => stripNaeiltourHtmlText(x)).filter(Boolean)
  }
  // REGRESSION-FREEZE[naeiltour-schedule-hotel-meal-extract]: 조식 뷔페 등 본문 식사 — manifest
  // 일정 본문 "조식후 ▶명소" 는 식사로 쓰지 않는다(POI는 places 경로).
  const plain = stripNaeiltourHtmlText(block)
  const out: string[] = []
  for (const m of plain.matchAll(/(?:조식|중식|석식)\s*(?:뷔페|호텔식|한식|현지식|기내식|포함|제공)?[^\n▶|]{0,40}/g)) {
    let t = String(m[0] ?? '')
      .replace(/\s+/g, ' ')
      .trim()
    // 문과장 1106: '조식후 전용차량을…' 같은 일정 문장은 식사가 아님
    if (/^(?:조식|중식|석식)\s*(?:후|뒤)\s*\S/u.test(t)) continue
    if (/^(?:조식|중식|석식)\s+\S.*(?:이동|미팅|출발|도착|관광|체크|투어)/u.test(t)) continue
    t = t.replace(/(?:후|뒤)\s*$/u, '').trim()
    if (/^(?:조식|중식|석식)\s*(?:후|뒤)?$/u.test(t)) continue
    if (t.length >= 2 && t.length <= 48 && !out.includes(t)) out.push(t)
  }
  return out.slice(0, 6)
}

function extractHotelFromBlock(block: string): string | null {
  const stay = block.match(/<div class="stay">([\s\S]*?)<\/div>/i)?.[1]
  if (!stay) return null
  let t = stripNaeiltourHtmlText(stay).replace(/^숙박\s*/, '').trim()
  if (!t) return null
  // REGRESSION-FREEZE[naeiltour-schedule-hotel-meal-extract]: stay 호텔명 축약 — manifest
  t = t
    .replace(/^\[(?:저녁|심야|오전|오후)[^\]]*\]\s*/i, '')
    .replace(/\s*[-–—]\s*.+$/, '')
    .replace(/\s*(?:체크인|투숙).*$/u, '')
    .replace(/\s*&\s*.+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return t || stripNaeiltourHtmlText(stay).replace(/^숙박\s*/, '').trim() || null
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

function extractNaeiltourBodyPlaceLabels(block: string): string[] {
  // 문과장 1106 v3: 세 경로(▶·see 헤딩·명소 카드)를 원문 위치 순서로 합친다(경로별 순서 뒤섞임 방지)
  const found: { at: number; t: string }[] = []
  const push = (raw: string, at = 0) => {
    const t = stripNaeiltourHtmlText(raw)
      .replace(/^▶\s*/, '')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim()
    if (!t || t.length < 2 || t.length > 80) return
    if (/^(?:조식|중식|석식|호텔|숙박|이동|출발|도착|자유\s*시간)/u.test(t)) return
    const prev = found.find((x) => x.t === t)
    if (!prev) found.push({ at, t })
    else if (at < prev.at) prev.at = at
  }
  for (const m of block.matchAll(/▶\s*([^<\n]{2,80})/g)) push(m[1] ?? '', m.index ?? 0)
  // 문과장 1106: img alt(포인트/important/close/배너)는 아이콘 캡션 — 장소로 쓰지 않음.
  // 실제 관광지는 <h2><img icon_schedule_see …/>이름 [English]</h2> (원문 구조). 식당(food)·이동(bus)·안내(dot)는 제외.
  for (const m of block.matchAll(/<h2>\s*<img[^>]*icon_schedule_see[^>]*>\s*([^<]{2,80})<\/h2>/gi)) {
    const raw = stripNaeiltourHtmlText(m[1] ?? '').replace(/&amp;/g, '&').trim()
    // 한글명 뒤 영문 병기만 떼어냄 (원문 h3 <span>English</span> 와 동일 구조)
    const ko = /^(.*[가-힣)\]])\s+[A-Za-z][A-Za-z0-9 .,'&()-]*$/u.exec(raw)
    push(ko ? ko[1]! : raw, m.index ?? 0)
  }
  // 문과장 1106 v3: 아이콘이 dot 이어도 h2 바로 뒤에 원문 명소 카드(<ul class="desc"><li><h3>이름[<span>영문</span>]</h3>)가 붙은 경우만,
  // h2 줄(<br> 단위) 중 카드 이름으로 시작하는(또는 카드 이름이 그 줄로 시작하는) 줄을 장소로 쓴다.
  // 카드가 없거나 어느 줄도 카드 이름과 맞지 않으면 무시(일반 안내·이동·식사 문구는 들어오지 않음).
  for (const m of block.matchAll(
    /<h2>\s*<img[^>]*icon_schedule_(?:dot|see)[^>]*>((?:(?!<\/?h2)[\s\S]){2,400}?)<\/h2>\s*<ul class="desc">\s*<li[^>]*>\s*<h3>([^<]{2,40})(?:<span>|<\/h3>)/gi,
  )) {
    const card = stripNaeiltourHtmlText(m[2] ?? '').replace(/&amp;/g, '&').trim()
    if (!card) continue
    const lines = String(m[1] ?? '')
      .split(/<br\s*\/?>/i)
      .map((x) => stripNaeiltourHtmlText(x).replace(/&amp;/g, '&').replace(/^[▶\s-]+/u, '').trim())
      .filter((x) => x.length >= 2)
    const hit = lines.find((x) => x.startsWith(card) || (x.length >= 4 && card.startsWith(x)))
    if (!hit) continue
    const ko = /^(.*[가-힣)\]])\s+[A-Za-z][A-Za-z0-9 .,'&()-]*$/u.exec(hit)
    push(ko ? ko[1]! : hit, m.index ?? 0)
  }
  return found.sort((a, b) => a.at - b.at).map((x) => x.t)
}

const NAEILTOUR_KR_HUB_SRC = '인천|김포|김해|부산|대구|청주|제주|무안|양양'

/** 일정 본문 h2 중 공항 출발·도착 줄. 헤더 strong(도시-도시)은 포함하지 않는다. */
function extractNaeiltourMovementLines(block: string): string[] {
  const out: string[] = []
  for (const m of block.matchAll(/<h2>\s*(?:<img[^>]*>\s*)?([^<]{2,160})<\/h2>/gi)) {
    const t = stripNaeiltourHtmlText(m[1] ?? '').replace(/\s+/g, ' ').trim()
    if (!t || t.length > 80) continue
    if (!/(?:공항).{0,16}(?:출발|도착)|(?:출발|도착).{0,8}공항/u.test(t)) continue
    if (!out.includes(t)) out.push(t)
  }
  return out
}

function naeiltourDay1DepartureBody(lines: readonly string[]): string | null {
  const re = new RegExp(`(?:${NAEILTOUR_KR_HUB_SRC})\\s*(?:국제\\s*)?공항[^\\n]{0,16}출발`, 'u')
  return lines.find((l) => re.test(l)) ?? null
}

export function parseNaeiltourScheduleDaysFromTab1(html: string | null): NaeiltourParsedScheduleDay[] {
  if (!html?.trim()) return []
  const days: NaeiltourParsedScheduleDay[] = []
  // Live HTML uses schedule_wrapq; older fixtures keep schedule_wrap.
  const chunks = html.split(/<div class="schedule_wrapq?">/i).slice(1)
  // 문과장 1106: live tab1 은 같은 일정을 PC/모바일/인쇄 3벌로 반복 — 일차별 첫 블록만 사용(뒤 블록은 footer까지 붙음)
  const seenDays = new Set<number>()
  for (const chunk of chunks) {
    const header = chunk.match(/(\d+)일차[\s\S]*?<strong>\s*([^<]+?)\s*<\/strong>/i)
    if (!header?.[1] || !header[2]) continue
    const day = Number(header[1])
    if (!Number.isFinite(day) || day <= 0) continue
    if (seenDays.has(day)) continue
    seenDays.add(day)
    const strongText = stripNaeiltourHtmlText(header[2]!)
    const dateIso = parseDateIsoFromStrong(strongText)
    const routeRaw = strongText.replace(/^\d{4}\/\d{1,2}\/\d{1,2}\([^)]*\)\s*/, '').trim()
    const headerPlaces = routeRaw
      .split(/-/)
      .map((s) => s.trim())
      .filter(Boolean)
    const bodyPlaces = extractNaeiltourBodyPlaceLabels(chunk)
    const places = dedupeNaeiltourScheduleRoutePlaces([...headerPlaces, ...bodyPlaces]).slice(0, 12)
    const englishRouteLandmarks = extractEnglishLandmarksFromBlock(chunk)
    const meals = extractMealsFromBlock(chunk)
    const hotel = extractHotelFromBlock(chunk)
    const transportNote = joinNaeiltourScheduleRouteText(places)
    // REGRESSION-FREEZE[parser-nl-hub-and-return-template]: 본문 공항 출발 줄·관광 없는 날의 공급사 이동 줄 — manifest
    const movementLines = extractNaeiltourMovementLines(chunk)
    const sourceDepartureBody = day === 1 ? naeiltourDay1DepartureBody(movementLines) : null
    const supplierTimeline = bodyPlaces.length === 0 && movementLines.length > 0 ? movementLines : undefined
    days.push({
      day,
      places,
      hotels: hotel ? [hotel] : [],
      meals,
      transportNote,
      englishRouteLandmarks,
      dateIso,
      sourceDepartureBody,
      ...(supplierTimeline ? { supplierTimeline } : {}),
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

/**
 * 같은 실행(프로세스) 안 상세 묶음 공유 — view.asp·tab0·tab1 본문만.
 * 출발일·가격(program_process)은 여기 들어오지 않으며 캐시하지 않는다. DB/파일 캐시 없음.
 * REGRESSION-FREEZE[naeiltour-fetch-resilience]: in-flight 공유·성공만 10분 캐시·실패 즉시 재호출 금지 — manifest
 */
const NAEILTOUR_DETAIL_BUNDLE_CACHE_TTL_MS = 10 * 60_000
/** 실패 결과는 캐시에 넣지 않되, 같은 실행 흐름에서 곧바로 다시 부르지 않도록 짧게 막는다. */
const NAEILTOUR_DETAIL_BUNDLE_FAILURE_COOLDOWN_MS = 60_000

type NaeiltourDetailBundleMemo = { expiresAt: number; value: NaeiltourRegisterDetailFetchOutcome }

const detailBundleInFlight = new Map<string, Promise<NaeiltourRegisterDetailFetchOutcome>>()
const detailBundleCache = new Map<string, NaeiltourDetailBundleMemo>()
const detailBundleFailureCooldown = new Map<string, NaeiltourDetailBundleMemo>()

export function resetNaeiltourRegisterDetailBundleMemoForTests(): void {
  detailBundleInFlight.clear()
  detailBundleCache.clear()
  detailBundleFailureCooldown.clear()
}

function detailFetchError(part: NaeiltourDetailFetchPart, r: NaeiltourTextFetchResult): NaeiltourDetailFetchError | null {
  if (r.ok) return null
  return {
    part,
    errorKind: r.errorKind,
    status: r.status,
    attempts: r.attempts.length,
    elapsedMs: r.elapsedMs,
    url: r.url,
  }
}

async function fetchNaeiltourRegisterDetailBundleUncached(
  url: string,
  goodCd: string,
): Promise<NaeiltourRegisterDetailFetchOutcome> {
  const referer = url.includes('#') ? url : `${url}${url.includes('?') ? '' : '?'}`
  const page = await fetchNaeiltourTextResult(
    url.split('#')[0]!,
    { headers: { referer: NAEILTOUR_BASE } },
    { part: 'page', timeoutMs: NAEILTOUR_VIEW_PAGE_TIMEOUT_MS },
  )
  if (!page.ok) {
    return { outcome: 'page_failed', bundle: null, fetchErrors: [detailFetchError('page', page)!] }
  }
  const pageHtml = page.text
  // REGRESSION-FREEZE[register-pre-photo-naeiltour-unsellable-no-stub]: 판매불가면 tab 수집·stub 금지 — manifest
  if (naeiltourDetailHtmlLooksUnsellable(pageHtml)) {
    return { outcome: 'unsellable', bundle: null, fetchErrors: [] }
  }

  await pace()
  const tab0 = await fetchNaeiltourViewTabHtmlResult(pageHtml, 0, referer)
  await pace()
  const tab1 = await fetchNaeiltourViewTabHtmlResult(pageHtml, 1, referer)

  const fetchErrors = [detailFetchError('tab0', tab0), detailFetchError('tab1', tab1)].filter(
    (e): e is NaeiltourDetailFetchError => e != null,
  )
  const hidden = hiddenInputsFromHtml(pageHtml)
  const bundle: NaeiltourRegisterDetailBundle = {
    originUrl: url,
    referer,
    pageHtml,
    tab0Html: tab0.ok ? tab0.text : null,
    tab1Html: tab1.ok ? tab1.text : null,
    goodCd: hidden.good_cd?.trim() || goodCd,
    eventSeq: parseNaeiltourEventSeqFromHtml(pageHtml),
    hidden,
    fetchStatus: { page: 'ok', tab0: tab0.ok ? 'ok' : 'failed', tab1: tab1.ok ? 'ok' : 'failed' },
    fetchErrors,
  }
  return { outcome: fetchErrors.length ? 'partial' : 'ok', bundle, fetchErrors }
}

export async function fetchNaeiltourRegisterDetailBundleResult(
  originUrl: string,
): Promise<NaeiltourRegisterDetailFetchOutcome> {
  const url = originUrl.trim()
  const goodCd = parseNaeiltourGoodCdFromUrl(url)
  if (!url || !goodCd || !/naeiltour\.co\.kr/i.test(url)) {
    return { outcome: 'invalid_url', bundle: null, fetchErrors: [] }
  }
  const key = url.split('#')[0]!
  const now = Date.now()
  for (const memo of [detailBundleCache, detailBundleFailureCooldown]) {
    const hit = memo.get(key)
    if (hit && hit.expiresAt > now) return hit.value
    if (hit) memo.delete(key)
  }
  const pending = detailBundleInFlight.get(key)
  if (pending) return pending

  const run = fetchNaeiltourRegisterDetailBundleUncached(url, goodCd)
    .then((value) => {
      const memo = value.outcome === 'ok' ? detailBundleCache : detailBundleFailureCooldown
      const ttl =
        value.outcome === 'ok' ? NAEILTOUR_DETAIL_BUNDLE_CACHE_TTL_MS : NAEILTOUR_DETAIL_BUNDLE_FAILURE_COOLDOWN_MS
      memo.set(key, { expiresAt: Date.now() + ttl, value })
      if (value.fetchErrors.length) {
        console.warn(
          '[naeiltour-detail-bundle] fetch incomplete',
          JSON.stringify({ goodCd, outcome: value.outcome, fetchErrors: value.fetchErrors }),
        )
      }
      return value
    })
    .finally(() => {
      detailBundleInFlight.delete(key)
    })
  detailBundleInFlight.set(key, run)
  return run
}

/** 판매불가·view.asp 실패·URL 오류면 null. 탭 실패는 bundle.fetchStatus/fetchErrors로 표시. */
export async function fetchNaeiltourRegisterDetailBundle(originUrl: string): Promise<NaeiltourRegisterDetailBundle | null> {
  return (await fetchNaeiltourRegisterDetailBundleResult(originUrl)).bundle
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
