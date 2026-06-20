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
import { filterOptionalTourRows, type OptionalTourRowFields } from '@/lib/optional-tour-row-gate-lottetour'
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
    .filter((c) => c.length > 1 && c.length < 80 && !/\d+\s*일차/.test(c))
}

export function parseLottetourScheduleDaysFromScheduleAjax(html: string | null): RegisterScheduleDay[] {
  if (!html?.trim()) return []
  const days: RegisterScheduleDay[] = []
  for (const { day, block } of lottetourScheduleDayBlocks(html)) {
    const uniqueCities = [...new Set(lottetourCitiesFromDayBlock(block))]
    const planParts = [
      ...block.matchAll(/<p class="plan_info">([\s\S]*?)<\/p>/gi),
    ].map((m) => stripLottetourScheduleHtml(m[1] ?? '')).filter(Boolean)
    const hotelMatch = block.match(/class="txt_link"[^>]*>([^<]+)</i)?.[1]
    const hotelText = hotelMatch ? stripLottetourScheduleHtml(hotelMatch).slice(0, 200) : null
    const title =
      uniqueCities[0] ??
      block.match(/<strong>\s*(\d+)일차\s*<\/strong>/i)?.[0]?.replace(/<[^>]+>/g, '').trim() ??
      `${day}일차`
    const description = planParts.join('\n').slice(0, 1200) || title
    const routeText = uniqueCities.length > 0 ? uniqueCities.join(' - ') : null
    const breakfastText = lottetourMealFromBlock(block, '조식')
    const lunchText = lottetourMealFromBlock(block, '중식')
    const dinnerText = lottetourMealFromBlock(block, '석식')
    const mealParts = [breakfastText, lunchText, dinnerText].filter(Boolean) as string[]
    days.push({
      day,
      title,
      description,
      routeText,
      imageKeyword: (uniqueCities[0] ?? title).slice(0, 80),
      hotelText,
      breakfastText,
      lunchText,
      dinnerText,
      mealSummaryText: mealParts.length > 0 ? mealParts.join(' / ') : null,
    })
  }
  return days
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
