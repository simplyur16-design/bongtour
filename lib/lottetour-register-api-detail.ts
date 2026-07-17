/**
 * 롯데관광 등록 상세카드 — evtDetailBasicAjax·evtDetailCoreInfo 파싱 SSOT.
 *
 * REGRESSION-FREEZE[lottetour-register-detail-collect]: basicAjax·coreInfo 매핑·godId-only evtCd resolve — manifest
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
import { filterOptionalTourRows, type OptionalTourRowFields } from '@/lib/optional-tour-row-gate-lottetour'
import {
  applyLottetourScheduleExpressionToRows,
  composeLottetourScheduleDescription,
  extractLottetourSchedulePlacesFromCityLabels,
  joinLottetourScheduleRouteText,
} from '@/lib/lottetour-register-api-schedule'
import type { RegisterScheduleDay } from '@/lib/register-llm-schema-lottetour'

const LOTTETOUR_BASE = process.env.LOTTETOUR_BASE_URL ?? 'https://www.lottetour.com'
/** 등록 상세카드 HTTP 호출 간격 — lottetour 전용(공용 스크래퍼 설정과 분리). */
const LOTTETOUR_REGISTER_DETAIL_PACE_MS = 220

export type LottetourRegisterDetailBundle = {
  basicAjaxHtml: string | null
  coreInfoHtml: string | null
  scheduleAjaxHtml: string | null
  spotListAjaxHtml: string | null
  evtListRow: LottetourCalendarRow | null
  evtCd: string | null
  godId: string | null
  godScheId: string | null
}

export type LottetourMeetingExtract = {
  meetingPlaceRaw: string | null
  meetingInfoRaw: string | null
  meetingNoticeRaw: string | null
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

export type LottetourShoppingRowExtract = {
  itemType: string
  placeName: string
  durationText: string | null
  refundPolicyText: string | null
  visitNo: number | null
  raw: string
}

function lottetourShoppingSectionHtml(html: string): string | null {
  const m = html.match(
    /<div class="travel_info_cont"[^>]*>\s*<!--\s*쇼핑\s*-->[\s\S]*?<\/div>\s*<!--\s*\/\/travel_info_cont\s*:\s*쇼핑\s*-->/i,
  )
  return m?.[0] ?? null
}

export function extractLottetourShoppingVisitCountFromSpotList(html: string | null): number | null {
  if (!html?.trim()) return null
  const section = lottetourShoppingSectionHtml(html)
  if (!section) return null
  const m =
    section.match(/id="shopCnt"[^>]*>\s*(\d+)\s*</i) ??
    section.match(/총\s*<[^>]+>\s*(\d+)\s*<\/span>\s*회의\s*쇼핑/i)
  if (!m?.[1]) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n >= 0 && n < 100 ? n : null
}

/** evtSpotListAjax — 쇼핑정보 표(품목·장소·소요·환불) */
export function extractLottetourShoppingFromSpotListAjax(html: string | null): {
  visitCount: number | null
  rows: LottetourShoppingRowExtract[]
} {
  if (!html?.trim()) return { visitCount: null, rows: [] }
  const section = lottetourShoppingSectionHtml(html)
  if (!section) return { visitCount: null, rows: [] }
  const visitCount = extractLottetourShoppingVisitCountFromSpotList(section)
  const rows: LottetourShoppingRowExtract[] = []
  const tbody = section.match(/<tbody>([\s\S]*?)<\/tbody>/i)?.[1] ?? ''
  for (const tr of tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...(tr[1] ?? '').matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
      stripLottetourScheduleHtml(m[1] ?? ''),
    )
    if (cells.length < 5) continue
    const visitNo = Number(String(cells[0] ?? '').replace(/[^\d]/g, ''))
    const itemType = (cells[1] ?? '').trim()
    const placeName = (cells[2] ?? '').trim()
    if (!itemType && !placeName) continue
    rows.push({
      visitNo: Number.isFinite(visitNo) && visitNo > 0 ? visitNo : null,
      itemType,
      placeName,
      durationText: (cells[3] ?? '').trim() || null,
      refundPolicyText: (cells[4] ?? '').trim() || null,
      raw: cells.filter(Boolean).join(' · ').slice(0, 400),
    })
  }
  return {
    visitCount: visitCount ?? (rows.length > 0 ? rows.length : null),
    rows,
  }
}

export function lottetourShoppingRowsToStructuredJson(rows: LottetourShoppingRowExtract[]): string | null {
  if (rows.length === 0) return null
  return JSON.stringify(
    rows.map((r) => ({
      itemType: r.itemType,
      placeName: r.placeName,
      durationText: r.durationText ?? '',
      refundPolicyText: r.refundPolicyText ?? '',
      raw: r.raw,
    })),
  )
}

export function lottetourCalendarRowToFlightStructured(row: LottetourCalendarRow | null): FlightStructured | null {
  return buildLottetourFlightStructuredFromRegisterSources({ scheduleAjaxHtml: null, evtListRow: row })
}

function lottetourFlightNoFromText(text: string | null | undefined): string | null {
  const m = String(text ?? '').match(/\b([A-Z]{2}\d{2,4})\b/i)
  return m?.[1]?.toUpperCase() ?? null
}

function lottetourTimeTokenFromText(text: string | null | undefined): string | null {
  const raw = String(text ?? '').trim()
  if (!raw) return null
  const times = raw.match(/\d{1,2}:\d{2}/g)
  return times?.[0] ?? null
}

function lottetourSecondTimeTokenFromText(text: string | null | undefined): string | null {
  const raw = String(text ?? '').trim()
  if (!raw) return null
  const times = raw.match(/\d{1,2}:\d{2}/g)
  return times && times.length > 1 ? times[1]! : null
}

function parseLottetourAirPlanCityHtml(html: string): {
  mmdd: string | null
  time: string | null
  place: string | null
} {
  const flat = stripLottetourScheduleHtml(html.replace(/<br\s*\/?>/gi, ' '))
  const m =
    flat.match(/(\d{2})\/(\d{2})\s*\(([가-힣])\s*\)\s*(\d{1,2}:\d{2})/) ??
    flat.match(/(\d{2})\/(\d{2})\s*\(([가-힣])\)\s*(\d{1,2}:\d{2})/)
  const place = html.match(/<span>([^<]+)<\/span>/i)?.[1]?.trim() ?? null
  return {
    mmdd: m ? `${m[1]}/${m[2]}` : null,
    time: m?.[4] ?? null,
    place,
  }
}

function ymdFromBaseYmdAndMmDd(baseYmd: string | null | undefined, mmdd: string | null): string | null {
  if (!baseYmd || !mmdd) return null
  const [mm, dd] = mmdd.split('/')
  if (!mm || !dd) return null
  return `${baseYmd.slice(0, 4)}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

type LottetourScheduleAirPlan = {
  flightNo: string | null
  depMmdd: string | null
  depTime: string | null
  depPlace: string | null
  arrMmdd: string | null
  arrTime: string | null
  arrPlace: string | null
  legKind: 'outbound' | 'inbound' | 'unknown'
}

/** evtDetailScheduleAjax — air_plan 편명·공항·일시 (REGRESSION-FREEZE[lottetour-register-detail-collect]) */
export function extractLottetourAirPlansFromScheduleAjax(html: string | null): LottetourScheduleAirPlan[] {
  if (!html?.trim()) return []
  const plans: LottetourScheduleAirPlan[] = []
  for (const m of html.matchAll(/<div class="air_plan">([\s\S]*?)<\/div>\s*<\/div>/gi)) {
    const block = m[1] ?? ''
    const flightNo =
      lottetourFlightNoFromText(block.match(/<div class="info">([^<]+)</i)?.[1]) ?? null
    const dep = parseLottetourAirPlanCityHtml(block.match(/<div class="city_s">([\s\S]*?)<\/div>/i)?.[1] ?? '')
    const arr = parseLottetourAirPlanCityHtml(block.match(/<div class="city_a">([\s\S]*?)<\/div>/i)?.[1] ?? '')
    const legKind: LottetourScheduleAirPlan['legKind'] = /한국[\s\S]{0,48}출발/i.test(block)
      ? 'outbound'
      : /한국[\s\S]{0,48}도착/i.test(block)
        ? 'inbound'
        : 'unknown'
    plans.push({
      flightNo,
      depMmdd: dep.mmdd,
      depTime: dep.time,
      depPlace: dep.place,
      arrMmdd: arr.mmdd,
      arrTime: arr.time,
      arrPlace: arr.place,
      legKind,
    })
  }
  return plans
}

/** scheduleAjax air_plan + evtListAjax — 편명·항공사·일시 SSOT (REGRESSION-FREEZE[lottetour-register-detail-collect]) */
export function buildLottetourFlightStructuredFromRegisterSources(args: {
  scheduleAjaxHtml: string | null
  evtListRow: LottetourCalendarRow | null
}): FlightStructured | null {
  const { scheduleAjaxHtml, evtListRow } = args
  const plans = extractLottetourAirPlansFromScheduleAjax(scheduleAjaxHtml)
  const obPlan = plans.find((p) => p.legKind === 'outbound') ?? plans[0] ?? null
  const ibPlan =
    plans.find((p) => p.legKind === 'inbound') ??
    (plans.length > 1 ? plans[plans.length - 1]! : null)

  const carrierRaw = evtListRow?.carrierText?.trim() || null
  const airlineName =
    carrierRaw && !lottetourFlightNoFromText(carrierRaw) ? carrierRaw : carrierRaw

  const obFlightNo =
    obPlan?.flightNo ??
    lottetourFlightNoFromText(evtListRow?.departTimeText) ??
    lottetourFlightNoFromText(carrierRaw)
  const ibFlightNo =
    ibPlan?.flightNo ??
    lottetourFlightNoFromText(evtListRow?.returnTimeText) ??
    obFlightNo

  const obDepTime =
    obPlan?.depTime ?? lottetourTimeTokenFromText(evtListRow?.departTimeText)
  const obArrTime =
    obPlan?.arrTime ?? lottetourSecondTimeTokenFromText(evtListRow?.departTimeText)
  const ibDepTime =
    ibPlan?.depTime ?? lottetourTimeTokenFromText(evtListRow?.returnTimeText)
  const ibArrTime =
    ibPlan?.arrTime ?? lottetourSecondTimeTokenFromText(evtListRow?.returnTimeText)

  const obDepDate =
    ymdFromBaseYmdAndMmDd(obPlan?.depMmdd ? evtListRow?.departDate : null, obPlan?.depMmdd ?? null) ??
    evtListRow?.departDate ??
    null
  const obArrDate =
    ymdFromBaseYmdAndMmDd(obPlan?.arrMmdd ? evtListRow?.departDate : null, obPlan?.arrMmdd ?? null) ??
    obDepDate
  const ibDepDate =
    ymdFromBaseYmdAndMmDd(ibPlan?.depMmdd ? evtListRow?.returnDate ?? evtListRow?.departDate : null, ibPlan?.depMmdd ?? null) ??
    evtListRow?.returnDate ??
    evtListRow?.departDate ??
    null
  const ibArrDate =
    ymdFromBaseYmdAndMmDd(ibPlan?.arrMmdd ? evtListRow?.returnDate ?? evtListRow?.departDate : null, ibPlan?.arrMmdd ?? null) ??
    ibDepDate

  const outbound: FlightStructured['outbound'] = {
    departureAirport: obPlan?.depPlace ?? null,
    departureAirportCode: null,
    departureDate: obDepDate ?? null,
    departureTime: obDepTime ?? null,
    arrivalAirport: obPlan?.arrPlace ?? null,
    arrivalAirportCode: null,
    arrivalDate: obArrDate ?? null,
    arrivalTime: obArrTime ?? null,
    flightNo: obFlightNo ?? null,
    durationText: evtListRow?.durationText ?? null,
  }
  const inbound: FlightStructured['inbound'] = {
    departureAirport: ibPlan?.depPlace ?? null,
    departureAirportCode: null,
    departureDate: ibDepDate ?? null,
    departureTime: ibDepTime ?? null,
    arrivalAirport: ibPlan?.arrPlace ?? null,
    arrivalAirportCode: null,
    arrivalDate: ibArrDate ?? null,
    arrivalTime: ibArrTime ?? null,
    flightNo: ibFlightNo ?? null,
    durationText: evtListRow?.durationText ?? null,
  }

  const hasOb = Boolean(outbound.flightNo || outbound.departureTime)
  const hasIb = Boolean(inbound.flightNo || inbound.departureTime)
  if (!hasOb && !hasIb) return null

  return {
    airlineName,
    outbound,
    inbound,
    rawFlightLines: [evtListRow?.departTimeText, evtListRow?.returnTimeText, carrierRaw].filter(
      Boolean,
    ) as string[],
    debug: {
      candidateCount: plans.length || 1,
      selectedOutRaw: obFlightNo ?? evtListRow?.departTimeText ?? null,
      selectedInRaw: ibFlightNo ?? evtListRow?.returnTimeText ?? null,
      partialStructured: !(hasOb && hasIb && airlineName && obFlightNo && ibFlightNo),
      status: hasOb && hasIb && airlineName && obFlightNo && ibFlightNo ? 'success' : 'partial',
      exposurePolicy: 'public_full',
      supplierBrandKey: 'lottetour',
      expectFlightNumber: true,
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

/** basicAjax·headInfo 스크립트에서 행사별 godScheId 추출 — godId와 다름. */
export function extractLottetourGodScheIdFromBasicAjax(
  html: string | null,
  evtCd: string,
): string | null {
  if (!html || !evtCd.trim()) return null
  const esc = evtCd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const fromCall = html.match(
    new RegExp(
      `callEvtDetailScheBasDetlLisAjax\\s*\\(\\s*['"]${esc}['"]\\s*,\\s*['"](\\d+)['"]`,
      'i',
    ),
  )?.[1]
  if (fromCall) return fromCall
  const fromSchedule = html.match(
    new RegExp(`callScheduleListAjax\\s*\\(\\s*['"]${esc}['"]\\s*,\\s*['"](\\d+)['"]`, 'i'),
  )?.[1]
  if (fromSchedule) return fromSchedule
  const fromPdf = html.match(/GOD_SCHE_ID\^(\d+)/i)?.[1]
  return fromPdf ?? null
}

export async function fetchLottetourScheduleAjaxHtml(
  evtCd: string,
  referer: string,
): Promise<string | null> {
  const cd = evtCd.trim()
  if (!cd) return null
  const q = new URLSearchParams({ evtCd: cd, viewType: 'basic' })
  // viewType=basic — evtDetailScheduleAjax SSOT param (godId·godScheId 불필요)
  return fetchLottetourRegisterHtml(`/evtDetailScheduleAjax?${q}`, referer)
}

export async function fetchLottetourSpotListAjaxHtml(
  evtCd: string,
  godScheId: string,
  referer: string,
): Promise<string | null> {
  const cd = evtCd.trim()
  const sid = godScheId.trim()
  if (!cd || !sid) return null
  const q = new URLSearchParams({ evtCd: cd, godScheId: sid, viewType: 'basic' })
  // evtSpotListAjax viewType=basic + godScheId from basicAjax
  return fetchLottetourRegisterHtml(`/evtSpotListAjax?${q}`, referer)
}

function stripLottetourScheduleHtml(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&middot;/gi, '·')
    .replace(/\s+/g, ' ')
    .trim()
}

function lottetourScheduleDayBlocks(html: string): Array<{ day: number; block: string }> {
  const out: Array<{ day: number; block: string }> = []
  const re =
    /<dl[^>]*id\s*=\s*"sche_plan_(\d+)"[^>]*class="day_plan"[^>]*>([\s\S]*?)<!--\s*\/\/day_plan\s*-->/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const day = Number(m[1])
    if (!Number.isFinite(day) || day <= 0) continue
    out.push({ day, block: m[2] ?? '' })
  }
  return out.sort((a, b) => a.day - b.day)
}

function lottetourMealFromBlock(block: string, label: '조식' | '중식' | '석식'): string | null {
  const m = block.match(new RegExp(`\\[${label}\\]\\s*([^\\[<\\n]+)`, 'i'))
  const text = m?.[1]?.trim()
  if (!text || /불포함|^-$/i.test(text)) return null
  return text.slice(0, 120)
}

function lottetourCitiesFromDayBlock(block: string): string[] {
  const timeline = block.match(
    /<div class="timeline">([\s\S]*?)(?:<\/div>\s*<!--\s*\/\/timeline|<div class="table_in")/i,
  )?.[1]
  if (!timeline) return []
  return [...timeline.matchAll(/<strong>([^<]+)<\/strong>/gi)]
    .map((m) => stripLottetourScheduleHtml(m[1] ?? ''))
    .filter(
      (c) =>
        c.length > 1 &&
        c.length <= 36 &&
        !/\d+\s*일차/.test(c) &&
        !/^[★☆▣]|기상\s*악화|결항|대체|불가|→|감상|이동|가이드|도착\s*후|출발\s*후|약\s*\d+|편\s*이용|모험의\s*땅|공존하는|풍경을|전망대|유산\s*국립|\d{1,2}:\d{2}/.test(
          c,
        ) &&
        // REGRESSION-FREEZE[lottetour-schedule-route-admin-noise]: 증명서·식사·포함일정 strong 제외 — manifest
        !/가족관계|증명서|면세\s*가능|면세(?:점|품)?(?:\s*\d+)?\s*(?:회\s*)?쇼핑|쇼핑\s*\d+\s*회|포함\s*일정|현지\s*가이드|현지\s*연락처|필수\s*서류|작성\s*및\s*제출|체류\s*가능|롯데관광\s*단독|^롯데$|한국보다\s*\d+\s*시간|(?:가정식|쌀국수|분짜|반쎄오|갑오징어).{0,12}(?:SET|세트)|(?:SET|세트)$|양식\s*SET|한식$|특식$|에그\s*타르트|광동식|^이태원$/i.test(
          c,
        ),
    )
}

function lottetourSpotNamesFromPlanInfo(block: string): string[] {
  const out: string[] = []
  for (const m of block.matchAll(/<p class="plan_info">([\s\S]*?)<\/p>/gi)) {
    const text = stripLottetourScheduleHtml(m[1] ?? '')
    for (const bracket of text.matchAll(/\[([^\]]{2,36})\]/g)) {
      const t = bracket[1]?.trim()
      if (!t) continue
      if (
        /조식|중식|석식|특전|시차|국가번호|관광\s*시간|호텔식|제육|된장|가족관계|증명서|면세|포함\s*일정|가정식|쌀국수|갑오징어|\bSET\b|세트$/i.test(
          t,
        )
      ) {
        continue
      }
      out.push(t)
    }
  }
  return out
}

export function parseLottetourScheduleDaysFromScheduleAjax(html: string | null): RegisterScheduleDay[] {
  if (!html?.trim()) return []
  const blocks = lottetourScheduleDayBlocks(html)
  const maxDay = blocks.reduce((m, b) => Math.max(m, b.day), 0)
  const days: RegisterScheduleDay[] = []
  for (const { day, block } of blocks) {
    const uniqueCities = [...new Set(lottetourCitiesFromDayBlock(block))]
    const planPlaces = lottetourSpotNamesFromPlanInfo(block)
    const planParts = [
      ...block.matchAll(/<p class="plan_info">([\s\S]*?)<\/p>/gi),
    ].map((m) => stripLottetourScheduleHtml(m[1] ?? '')).filter(Boolean)
    const routePlaces = extractLottetourSchedulePlacesFromCityLabels([...uniqueCities, ...planPlaces])
    const routeText = joinLottetourScheduleRouteText(routePlaces)
    // REGRESSION-FREEZE[lottetour-singapore-register-quality]: 숙박 txt_link — 써차지·포함 잡음 제외 — manifest
    const hotelRaw =
      block.match(/(?:숙박|호텔)[\s\S]{0,480}?class="txt_link"[^>]*>([^<]+)</i)?.[1] ??
      block.match(/class="txt_link"[^>]*>([^<]+)</i)?.[1] ??
      null
    const hotelCandidate = hotelRaw ? stripLottetourScheduleHtml(hotelRaw).slice(0, 200) : null
    const hotelText =
      hotelCandidate &&
      !/(?:써차지|추가\s*요금|포함\s*(?:사항|예정)|└|유류할증|여행자보험|TAX|노쇼핑)/i.test(hotelCandidate)
        ? hotelCandidate
        : null
    const title = routePlaces[0] ?? uniqueCities[0] ?? `${day}일차`
    const planInfoRaw = planParts.join(' ').trim()
    const joinedBlob = [routeText, planInfoRaw, ...uniqueCities].filter(Boolean).join(' ')
    // REGRESSION-FREEZE[lottetour-schedule-plan-info-description]: description은 vibe 2~3문장 (plan_info는 route·profile 근거) — manifest
    const description = composeLottetourScheduleDescription({
      day,
      maxDay,
      routePlaces,
      joinedBlob,
      planInfoRaw,
    })
    const breakfastText = lottetourMealFromBlock(block, '조식')
    const lunchText = lottetourMealFromBlock(block, '중식')
    const dinnerText = lottetourMealFromBlock(block, '석식')
    const mealParts = [breakfastText, lunchText, dinnerText].filter(Boolean) as string[]
    days.push({
      day,
      title,
      description,
      routeText,
      imageKeyword: '',
      imageKeyword2: null,
      hotelText,
      breakfastText,
      lunchText,
      dinnerText,
      mealSummaryText: mealParts.length > 0 ? mealParts.join(' / ') : null,
    })
  }
  return applyLottetourScheduleExpressionToRows(days)
}

export function extractLottetourMeetingFromScheduleAjax(html: string | null): LottetourMeetingExtract {
  if (!html?.trim()) {
    return { meetingPlaceRaw: null, meetingInfoRaw: null, meetingNoticeRaw: null }
  }
  const meetBlock = html.match(/<dl class="meet_area">[\s\S]*?<\/dl>/i)?.[0]
  if (!meetBlock) {
    return { meetingPlaceRaw: null, meetingInfoRaw: null, meetingNoticeRaw: null }
  }
  const dd = meetBlock.match(/<dd>([\s\S]*?)<\/dd>/i)?.[1] ?? ''
  const lines = stripLottetourScheduleHtml(dd)
    .split(/(?=▣)|\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2)
  const placeLine =
    lines.find((l) => /공항|터미널|미팅|집결|카운터/i.test(l) && l.length < 120) ??
    lines[0] ??
    null
  const noticeRaw = dd.match(/<p>([\s\S]*?)<\/p>/i)?.[1]
  return {
    meetingPlaceRaw: placeLine,
    meetingInfoRaw: stripLottetourScheduleHtml(dd).slice(0, 800) || null,
    meetingNoticeRaw: noticeRaw ? stripLottetourScheduleHtml(noticeRaw).slice(0, 600) : null,
  }
}

function lottetourOptionalSectionHtml(html: string): string | null {
  const m = html.match(
    /<div class="travel_info_cont on">\s*<!--\s*선택관광\s*-->[\s\S]*?<\/div>\s*<!--\s*\/\/travel_info_cont\s*:\s*선택관광\s*-->/i,
  )
  return m?.[0] ?? null
}

function parseLottetourOptionalPrice(text: string): {
  currency: string | null
  adultPrice: number | null
  priceText: string | null
} {
  const usd = text.match(/(?:USD|\$)\s*([0-9]+(?:[.,][0-9]+)?)/i)
  if (usd) {
    const adultPrice = Number(usd[1]!.replace(/,/g, ''))
    return {
      currency: 'USD',
      adultPrice: Number.isFinite(adultPrice) ? adultPrice : null,
      priceText: `USD ${usd[1]}`,
    }
  }
  const krw = text.match(/([0-9]{1,3}(?:,[0-9]{3})+)\s*원/)
  if (krw) {
    const adultPrice = Number(krw[1]!.replace(/,/g, ''))
    return {
      currency: 'KRW',
      adultPrice: Number.isFinite(adultPrice) ? adultPrice : null,
      priceText: `${krw[1]}원`,
    }
  }
  return { currency: null, adultPrice: null, priceText: null }
}

export function extractLottetourOptionalFromSpotListAjax(html: string | null): OptionalTourRowFields[] {
  if (!html?.trim()) return []
  const section = lottetourOptionalSectionHtml(html)
  if (!section) return []
  const out: OptionalTourRowFields[] = []
  const seen = new Set<string>()
  for (const dl of section.matchAll(/<dl class="dl_box type03">([\s\S]*?)<\/dl>/gi)) {
    const block = dl[1] ?? ''
    const label = block.match(/<dt>[\s\S]*?\[선택관광\]\s*([^<\[]+)/i)?.[1]
    const name = stripLottetourScheduleHtml(label ?? '')
    if (!name || seen.has(name)) continue
    const body = stripLottetourScheduleHtml(block.match(/<dd>([\s\S]*?)<\/dd>/i)?.[1] ?? '')
    const priceHay = stripLottetourScheduleHtml(
      block.match(/<table[\s\S]*?<\/table>/i)?.[0] ?? body,
    )
    const price = parseLottetourOptionalPrice(priceHay)
    const row: OptionalTourRowFields = {
      name,
      currency: price.currency,
      adultPrice: price.adultPrice,
      childPrice: null,
      durationText: body.match(/(?:소요|약)\s*[0-9]{1,2}\s*(?:분|시간)/i)?.[0]?.slice(0, 40) ?? null,
      minPaxText: null,
      guide同行Text: null,
      waitingPlaceText: null,
      raw: [name, body].filter(Boolean).join(' ').slice(0, 500),
      priceText: price.priceText,
    }
    if (!name) continue
    seen.add(name)
    out.push(row)
  }
  const tableDl = section.match(/<dl class="dl_box">\s*<dt>\s*선택관광\s*<\/dt>[\s\S]*?<\/dl>/i)?.[0]
  if (tableDl) {
    const tbody = tableDl.match(/<tbody>([\s\S]*?)<\/tbody>/i)?.[1] ?? ''
    for (const tr of tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...(tr[1] ?? '').matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) =>
        stripLottetourScheduleHtml(c[1] ?? ''),
      )
      if (cells.length < 2) continue
      const name = (cells[0] ?? '').trim()
      if (!name || seen.has(name) || /선택\s*관광명/i.test(name)) continue
      const priceHay = [cells[1], cells[2], cells[3]].filter(Boolean).join(' ')
      const price = parseLottetourOptionalPrice(priceHay)
      const row: OptionalTourRowFields = {
        name,
        currency: price.currency,
        adultPrice: price.adultPrice,
        childPrice: null,
        durationText: (cells[2] ?? '').trim().slice(0, 40) || null,
        minPaxText: null,
        guide同行Text: cells[4] === 'X' ? '인솔자 동행 없음' : cells[4] ?? null,
        waitingPlaceText: (cells[3] ?? '').trim() || null,
        raw: cells.filter(Boolean).join(' · ').slice(0, 500),
        priceText: price.priceText,
      }
      seen.add(name)
      out.push(row)
    }
  }
  return filterOptionalTourRows(out)
}

export function lottetourOptionalRowsToStructuredJson(rows: OptionalTourRowFields[]): string | null {
  if (rows.length === 0) return null
  return JSON.stringify(
    rows.map((r) => ({
      tourName: r.name,
      currency: r.currency ?? '',
      adultPrice: r.adultPrice ?? null,
      childPrice: r.childPrice ?? null,
      durationText: r.durationText ?? '',
      minPaxText: r.minPaxText ?? '',
      guide同行Text: r.guide同行Text ?? '',
      waitingPlaceText: r.waitingPlaceText ?? '',
      raw: r.raw,
      priceText: r.priceText ?? null,
      alternateScheduleText: r.alternateScheduleText ?? null,
    })),
  )
}

export function lottetourHaystackDeclaresNoOptional(haystack: string | null | undefined): boolean {
  const t = (haystack ?? '').trim()
  return /NO\s*옵션|노옵션|无选项|선택관광\s*없음/i.test(t)
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

/** evtList URL(godId·menu만) — evtListAjax에서 첫 가격 행으로 evtCd 시드. */
async function resolveLottetourEvtListSeedRow(
  godId: string,
  menuNos: [string, string, string, string],
  referer: string,
): Promise<LottetourCalendarRow | null> {
  const start = new Date()
  for (let i = 0; i < 4; i += 1) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
    const depDt = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
    const url = buildEvtListAjaxUrl({ depDt, godId, menuNos })
    const res = await fetch(url, {
      method: 'GET',
      headers: lottetourRegisterHeaders(referer),
      signal: AbortSignal.timeout(25_000),
    })
    if (!res.ok) continue
    const html = await res.text()
    if (!html || html.length < 3000) continue
    const parsed = parseLottetourEvtListAjaxHtml(html, { depYm: depDt, godId })
    const priced = parsed.rows.find((r) => r.adultPrice > 0 && r.evtCd)
    if (priced) return priced
    if (parsed.rows[0]?.evtCd) return parsed.rows[0]!
  }
  return null
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
  const godId = hints.godId
  let evtCd = ids.evtCd ?? hints.detailEvtCd
  let evtListRow: LottetourCalendarRow | null = null
  if (!evtCd && godId && hints.menuNos) {
    evtListRow = await resolveLottetourEvtListSeedRow(godId, hints.menuNos, url)
    evtCd = evtListRow?.evtCd ?? null
  }
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

  if (!evtListRow && hints.menuNos) {
    evtListRow = await fetchMatchingEvtListRow(evtCd, godId, hints.menuNos, referer)
  }

  const godScheId = extractLottetourGodScheIdFromBasicAjax(basicAjaxHtml, evtCd)
  await paceBetweenLottetourRegisterFetches()

  const scheduleAjaxHtml = await fetchLottetourScheduleAjaxHtml(evtCd, referer)
  await paceBetweenLottetourRegisterFetches()

  let spotListAjaxHtml: string | null = null
  if (godScheId) {
    spotListAjaxHtml = await fetchLottetourSpotListAjaxHtml(evtCd, godScheId, referer)
  }

  if (!basicAjaxHtml && !coreInfoHtml && !evtListRow && !scheduleAjaxHtml && !spotListAjaxHtml) {
    return null
  }
  return {
    basicAjaxHtml,
    coreInfoHtml,
    scheduleAjaxHtml,
    spotListAjaxHtml,
    evtListRow,
    evtCd,
    godId,
    godScheId,
  }
}

/** evtList(godId만)·evtDetail(evtCd) URL → 등록용 godId·evtCd SSOT. evtCd 없으면 evtListAjax 시드. */
export async function resolveLottetourRegisterOriginIdsFromUrl(originUrl: string): Promise<{
  godId: string | null
  evtCd: string | null
}> {
  const url = originUrl.trim()
  const ids = extractLottetourMasterIdsFromBlob(url)
  if (ids.evtCd && ids.godId) return ids
  if (!ids.evtCd && !ids.godId) return ids
  const bundle = await fetchLottetourRegisterDetailBundle(url)
  return {
    godId: bundle?.godId ?? ids.godId,
    evtCd: bundle?.evtCd ?? ids.evtCd,
  }
}

/** evtListAjax 행 — 잔여석·출발상태 SSOT (등록 미리보기·API 연동). */
export function applyLottetourRegisterEvtListRowMeta<
  T extends {
    remainingSeatsCount?: number | null
    seatsStatusRaw?: string | null
    departureStatusRaw?: string | null
  },
>(parsed: T, row: LottetourCalendarRow | null | undefined): T {
  if (!row) return parsed
  return {
    ...parsed,
    ...(row.seatCount != null ? { remainingSeatsCount: row.seatCount } : {}),
    ...(row.seatsStatusRaw?.trim() ? { seatsStatusRaw: row.seatsStatusRaw.trim() } : {}),
    ...(row.statusRaw?.trim() ? { departureStatusRaw: row.statusRaw.trim() } : {}),
  }
}
