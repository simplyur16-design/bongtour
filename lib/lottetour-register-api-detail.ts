/**
 * 롯데관광 등록 상세카드 — evtDetailBasicAjax·evtDetailCoreInfo 파싱 SSOT.
 *
 * REGRESSION-FREEZE[lottetour-register-detail-collect]: basicAjax·coreInfo 매핑 — manifest
 */
import {
  departDateFromLottetourEvtCd,
  enrichLottetourEvtListCollectionHintsFromDetailPage,
  parseLottetourEvtListAjaxHtml,
  parseLottetourEvtListCollectionHints,
  type LottetourCalendarRow,
} from '@/lib/lottetour-departures'
import { extractLottetourMasterIdsFromBlob } from '@/lib/lottetour-paste-deterministic-patch'
import type { FlightStructured } from '@/lib/detail-body-parser-types'

const LOTTETOUR_BASE = process.env.LOTTETOUR_BASE_URL ?? 'https://www.lottetour.com'
/** 등록 상세카드 HTTP 호출 간격 — lottetour 전용(공용 스크래퍼 설정과 분리). */
const LOTTETOUR_REGISTER_DETAIL_PACE_MS = 220

export type LottetourRegisterDetailBundle = {
  basicAjaxHtml: string | null
  coreInfoHtml: string | null
  evtListRow: LottetourCalendarRow | null
  evtCd: string | null
  godId: string | null
}

function lottetourRegisterHeaders(referer: string): HeadersInit {
  return {
    Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ko-KR',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Referer: referer,
  }
}

function paceBetweenLottetourRegisterFetches(): Promise<void> {
  return new Promise((r) => setTimeout(r, LOTTETOUR_REGISTER_DETAIL_PACE_MS))
}

async function fetchLottetourRegisterHtml(path: string, referer: string): Promise<string | null> {
  const url = `${LOTTETOUR_BASE.replace(/\/$/, '')}${path}`
  const res = await fetch(url, {
    method: 'GET',
    headers: lottetourRegisterHeaders(referer),
    signal: AbortSignal.timeout(25_000),
  })
  if (!res.ok) return null
  return await res.text()
}

export function stripLottetourHtmlText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&middot;/gi, '·')
    .replace(/\s+/g, ' ')
    .trim()
}

export function extractLottetourDdByDtLabel(html: string, label: string): string | null {
  const re = new RegExp(
    `<dt[^>]*>\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</dt>\\s*<dd[^>]*>([\\s\\S]*?)</dd>`,
    'i',
  )
  const m = html.match(re)
  if (!m?.[1]) return null
  return stripLottetourHtmlText(m[1])
}

export function htmlBulletsFromLottetourBlock(raw: string | null | undefined): string[] {
  const text = String(raw ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
  return text
    .split(/\n|(?=▣)|(?=∨)/)
    .map((line) => line.replace(/^[\s·▪▶\-–—▣∨]+/, '').trim())
    .filter((line) => line.length > 2 && line.length < 500)
}

export function extractLottetourIncludedExcludedFromBasicAjax(html: string | null): {
  includedItems: string[]
  excludedItems: string[]
} {
  if (!html) return { includedItems: [], excludedItems: [] }
  const includedItems = htmlBulletsFromLottetourBlock(
    extractLottetourDdByDtLabel(html, '포함사항') ?? html.match(/id="sche_b01"[^>]*>([\s\S]*?)<\/dd>/i)?.[1],
  )
  const excludedItems = htmlBulletsFromLottetourBlock(
    extractLottetourDdByDtLabel(html, '불포함사항') ?? html.match(/id="sche_b02"[^>]*>([\s\S]*?)<\/dd>/i)?.[1],
  )
  return { includedItems, excludedItems }
}

export type LottetourFeeExtract = {
  singleRoomSurchargeRaw: string | null
  singleRoomSurchargeAmount: number | null
  guideTipRaw: string | null
  visaNoteRaw: string | null
}

export function extractLottetourFeesFromExcluded(excludedItems: string[]): LottetourFeeExtract {
  let singleRoomSurchargeRaw: string | null = null
  let singleRoomSurchargeAmount: number | null = null
  let guideTipRaw: string | null = null
  let visaNoteRaw: string | null = null
  for (const line of excludedItems) {
    if (!singleRoomSurchargeRaw && /(싱글|1인\s*객실|싱글룸|써차지)/i.test(line)) {
      singleRoomSurchargeRaw = line
      const m = line.match(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})\s*원/)
      if (m) singleRoomSurchargeAmount = Number(m[1]!.replace(/,/g, ''))
    }
    if (!guideTipRaw && /(선내팁|가이드|기사|매너팁|팁)/i.test(line)) guideTipRaw = line
    if (!visaNoteRaw && /(비자|출국세|E-비자)/i.test(line)) visaNoteRaw = line
  }
  return { singleRoomSurchargeRaw, singleRoomSurchargeAmount, guideTipRaw, visaNoteRaw }
}

export function extractLottetourMustKnowFromBasicAjax(html: string | null): string[] {
  if (!html) return []
  const block =
    extractLottetourDdByDtLabel(html, '예약 시 유의사항') ??
    html.match(/id="sche_b03"[^>]*>([\s\S]*?)<\/dd>/i)?.[1] ??
    null
  return htmlBulletsFromLottetourBlock(block).slice(0, 10)
}

export function extractLottetourShoppingVisitCountFromCoreInfo(html: string | null): number | null {
  if (!html) return null
  const m =
    html.match(/포함된\s*쇼핑\s*횟수[\s\S]{0,120}?(\d+)\s*회/i) ??
    html.match(/쇼핑\s*횟수[\s\S]{0,80}?(\d+)\s*회/i)
  if (!m?.[1]) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n >= 0 && n < 100 ? n : null
}

export function lottetourCalendarRowToFlightStructured(row: LottetourCalendarRow | null): FlightStructured | null {
  if (!row) return null
  const carrier = row.carrierText?.trim() || null
  const depParts = row.departTimeText?.split(/\s*~\s*|\s+/) ?? []
  const retParts = row.returnTimeText?.split(/\s*~\s*|\s+/) ?? []
  const outbound = {
    departureAirport: null,
    departureAirportCode: null,
    departureDate: row.departDate,
    departureTime: depParts[0]?.trim() || null,
    arrivalAirport: null,
    arrivalAirportCode: null,
    arrivalDate: row.departDate,
    arrivalTime: depParts[1]?.trim() || null,
    flightNo: carrier,
    durationText: row.durationText,
  }
  const inbound = {
    departureAirport: null,
    departureAirportCode: null,
    departureDate: row.returnDate ?? row.departDate,
    departureTime: retParts[0]?.trim() || null,
    arrivalAirport: null,
    arrivalAirportCode: null,
    arrivalDate: row.returnDate ?? row.departDate,
    arrivalTime: retParts[1]?.trim() || null,
    flightNo: carrier,
    durationText: row.durationText,
  }
  if (!outbound.flightNo && !outbound.departureTime && !inbound.departureTime) return null
  return {
    airlineName: carrier,
    outbound,
    inbound,
    rawFlightLines: [row.departTimeText, row.returnTimeText, row.carrierText].filter(Boolean) as string[],
    debug: {
      candidateCount: 1,
      selectedOutRaw: row.departTimeText,
      selectedInRaw: row.returnTimeText,
      partialStructured: true,
      status: 'partial',
      exposurePolicy: 'public_limited',
      supplierBrandKey: 'lottetour',
      expectFlightNumber: false,
    },
    reviewNeeded: false,
    reviewReasons: [],
  }
}

function buildEvtListAjaxUrl(args: {
  depDt: string
  godId: string
  menuNos: readonly [string, string, string, string]
}): string {
  const u = new URL(`${LOTTETOUR_BASE.replace(/\/$/, '')}/evtlist/evtListAjax`)
  u.searchParams.set('depDt', args.depDt)
  u.searchParams.set('godId', args.godId)
  const [m1, m2, m3, m4] = args.menuNos
  u.searchParams.set('menuNo1', m1)
  u.searchParams.set('menuNo2', m2)
  u.searchParams.set('menuNo3', m3)
  u.searchParams.set('menuNo4', m4)
  u.searchParams.set('evtOrderBy', 'DT')
  u.searchParams.set('pageIndex', '1')
  u.searchParams.set('maxEvtCnt', '20')
  u.searchParams.set('template', 'evtList')
  return u.toString()
}

async function fetchMatchingEvtListRow(
  evtCd: string,
  godId: string,
  menuNos: [string, string, string, string],
  referer: string,
): Promise<LottetourCalendarRow | null> {
  const ymd = departDateFromLottetourEvtCd(evtCd)
  const depDt = ymd ? `${ymd.slice(0, 4)}${ymd.slice(5, 7)}` : null
  if (!depDt) return null
  const url = buildEvtListAjaxUrl({ depDt, godId, menuNos })
  const res = await fetch(url, {
    method: 'GET',
    headers: lottetourRegisterHeaders(referer),
    signal: AbortSignal.timeout(25_000),
  })
  if (!res.ok) return null
  const html = await res.text()
  if (!html || html.length < 3000) return null
  const parsed = parseLottetourEvtListAjaxHtml(html, { depYm: depDt, godId })
  return parsed.rows.find((r) => r.evtCd === evtCd) ?? null
}

export async function fetchLottetourRegisterDetailBundle(
  originUrl: string,
): Promise<LottetourRegisterDetailBundle | null> {
  const url = originUrl.trim()
  if (!url || !/lottetour\.com/i.test(url)) return null

  const ids = extractLottetourMasterIdsFromBlob(url)
  let hints = parseLottetourEvtListCollectionHints({ rawMeta: null, originUrl: url })
  if (!hints.godId || !hints.menuNos) {
    hints = await enrichLottetourEvtListCollectionHintsFromDetailPage(hints, url)
  }
  const evtCd = ids.evtCd ?? hints.detailEvtCd
  const godId = hints.godId
  if (!evtCd || !godId) return null

  const referer = url
  const ajaxParams = new URLSearchParams({
    evtCd,
    godId,
    evtcd: evtCd,
    godid: godId,
  })
  const basicAjaxHtml = await fetchLottetourRegisterHtml(`/evtDetailBasicAjax?${ajaxParams}`, referer)
  await paceBetweenLottetourRegisterFetches()

  const coreInfoHtml = await fetchLottetourRegisterHtml(`/evtDetailCoreInfo?${ajaxParams}`, referer)
  await paceBetweenLottetourRegisterFetches()

  let evtListRow: LottetourCalendarRow | null = null
  if (hints.menuNos) {
    evtListRow = await fetchMatchingEvtListRow(evtCd, godId, hints.menuNos, referer)
  }

  if (!basicAjaxHtml && !coreInfoHtml && !evtListRow) return null
  return { basicAjaxHtml, coreInfoHtml, evtListRow, evtCd, godId }
}
