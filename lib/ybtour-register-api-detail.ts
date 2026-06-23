/**
 * ybtour 등록 상세카드 — papi notice·event-schedule·tour-detail 파싱 SSOT.
 *
 * REGRESSION-FREEZE[ybtour-register-detail-collect]: papi notice·schedule·tour-detail 매핑 — manifest
 * REGRESSION-FREEZE[register-six-suppliers-live-gate]: inclInfo 단락 HTML bullet 분리 — manifest
 */
import {
  parseYbtourEvCdFromUrl,
  resolveYbtourGoodsCdForApi,
} from '@/lib/ybtour-api-departures'
import type { ShoppingStructured } from '@/lib/detail-body-parser-types'
import type { FlightStructured } from '@/lib/detail-body-parser-types'
import type { RegisterScheduleDay } from '@/lib/register-llm-schema-ybtour'
import { enrichScheduleMealFieldsFromText } from '@/lib/register-schedule-meal-parse'
import type { OptionalTourRowFields } from '@/lib/optional-tour-row-gate-ybtour'
import { parseYbtourShoppingVisitCount } from '@/lib/register-ybtour-shopping'
import { shoppingStructuredRowToPersistStop } from '@/lib/shopping-structured-row-to-persist'

const YBTOUR_PAPI_BASE = process.env.YBTOUR_PAPI_BASE_URL ?? 'https://papi.ybtour.co.kr'
/** 등록 상세카드 papi 호출 간격 — ybtour 전용(공용 스크래퍼 설정과 분리). */
const YBTOUR_REGISTER_DETAIL_PACE_MS = 180

type YbtourPapiEnvelope<T> = {
  code?: string
  message?: string
  body?: T
}

export type YbtourScheduleDetailRow = {
  dayNo?: number
  accommNm?: string | null
  accommNote?: string | null
  foodB?: string | null
  foodL?: string | null
  foodD?: string | null
}

export type YbtourScheduleTmRow = {
  dayNo?: number
  tmNo?: number
  tmTitle?: string | null
  tmContent?: string | null
  cityNm?: string | null
  outFlightNm?: string | null
  inFlightNm?: string | null
  outDeprtTm?: string | null
  outArrvTm?: string | null
  inDeprtTm?: string | null
  inArrvTm?: string | null
  outDeprtCityNm?: string | null
  outArrvCityNm?: string | null
  inDeprtCityNm?: string | null
  inArrvCityNm?: string | null
  meetAirPlace?: string | null
  meetAirTm?: string | null
  meetAirNote?: string | null
  evStartDt?: string | null
  evArriveDt?: string | null
}

export type YbtourScheduleBody = {
  scheduleDetail?: YbtourScheduleDetailRow[]
  scheduleDetailTm?: YbtourScheduleTmRow[]
}

export type YbtourNoticeBody = {
  inclInfo?: string | null
  notinclInfo?: string | null
  goodsInfo?: string | null
  essenInfo?: string | null
  miscInfo?: string | null
  passportInfo?: string | null
  shopCnt?: number | null
  shopInfo?: string | null
  optInfo?: string | null
}

export type YbtourTourDetailRow = {
  trvInfoNm?: string | null
  trvContent?: string | null
  trvInfoYn?: string | null
  optCost?: number | null
  refeNote?: string | null
  useTm?: string | null
}

export type YbtourOptionListRow = {
  title?: string | null
  intro?: string | null
  useTm?: string | null
  cost?: string | null
  note?: string | null
}

export type YbtourShopListRow = {
  shopNm?: string | null
  shopPlace?: string | null
  shopTm?: string | null
  refundNote?: string | null
}

export type YbtourOptionalTourDetailBody = {
  shopList?: YbtourShopListRow[] | null
  optionList?: YbtourOptionListRow[] | null
}

export type YbtourRegisterDetailBundle = {
  notice: YbtourNoticeBody | null
  schedule: YbtourScheduleBody | null
  tourDetail: YbtourTourDetailRow[] | null
  optionalTourDetail: YbtourOptionalTourDetailBody | null
}

function ybtourRegisterPapiHeaders(referer: string): HeadersInit {
  return {
    accept: 'application/json, text/plain, */*',
    'accept-language': 'ko-KR',
    referer,
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  }
}

async function fetchYbtourRegisterPapiJson<T>(path: string, referer: string): Promise<T | null> {
  const url = `${YBTOUR_PAPI_BASE.replace(/\/$/, '')}${path}`
  const res = await fetch(url, {
    method: 'GET',
    headers: ybtourRegisterPapiHeaders(referer),
    signal: AbortSignal.timeout(25_000),
  })
  if (!res.ok) return null
  const json = (await res.json()) as YbtourPapiEnvelope<T>
  if (json?.code !== '0000') return null
  return json.body ?? null
}

function paceBetweenRegisterDetailFetches(): Promise<void> {
  return new Promise((r) => setTimeout(r, YBTOUR_REGISTER_DETAIL_PACE_MS))
}

export function stripYbtourHtmlText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&middot;/gi, '·')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function htmlBulletsFromYbtourNotice(html: string | null | undefined): string[] {
  const text = stripYbtourHtmlText(String(html ?? ''))
  if (!text) return []
  return text
    .split(/\n+|(?=■\s)|(?=\d+\.\s)/)
    .map((line) => line.replace(/^[\s·▪▶\-–—■]+/, '').trim())
    .filter((line) => line.length > 2 && line.length < 500)
}

export function ybtourHmToDisplay(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim()
  if (!/^\d{4}$/.test(s)) return s || null
  return `${s.slice(0, 2)}:${s.slice(2, 4)}`
}

export function ybtourYmd8ToIso(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim()
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return null
}

export function ybtourScheduleBundleToRegisterSchedule(
  scheduleDetail: YbtourScheduleDetailRow[],
  scheduleDetailTm: YbtourScheduleTmRow[],
): RegisterScheduleDay[] {
  const detailByDay = new Map<number, YbtourScheduleDetailRow>()
  for (const row of scheduleDetail) {
    const day = Number(row.dayNo ?? 0)
    if (Number.isFinite(day) && day > 0) detailByDay.set(day, row)
  }

  const tmByDay = new Map<number, YbtourScheduleTmRow[]>()
  for (const row of scheduleDetailTm) {
    const day = Number(row.dayNo ?? 0)
    if (!Number.isFinite(day) || day <= 0) continue
    const list = tmByDay.get(day) ?? []
    list.push(row)
    tmByDay.set(day, list)
  }

  const days = [...new Set([...detailByDay.keys(), ...tmByDay.keys()])].sort((a, b) => a - b)
  const out: RegisterScheduleDay[] = []

  for (const day of days) {
    const detail = detailByDay.get(day)
    const tmRows = (tmByDay.get(day) ?? []).sort((a, b) => Number(a.tmNo ?? 0) - Number(b.tmNo ?? 0))
    const cities = [...new Set(tmRows.map((r) => String(r.cityNm ?? '').trim()).filter(Boolean))]
    const descParts: string[] = []
    for (const tm of tmRows) {
      const title = String(tm.tmTitle ?? '').trim()
      const content = stripYbtourHtmlText(String(tm.tmContent ?? ''))
      if (title && title !== ' ') descParts.push(title)
      if (content) descParts.push(content)
    }
    const title =
      tmRows.map((r) => String(r.tmTitle ?? '').trim()).find((t) => t && t !== ' ') ??
      cities[0] ??
      `${day}일차`
    const description = descParts.join('\n') || title
    const routeText = cities.length > 0 ? cities.join(' - ') : null
    const hotelText =
      String(detail?.accommNm ?? '').trim() ||
      (detail?.accommNote ? stripYbtourHtmlText(detail.accommNote).slice(0, 120) : null) ||
      null
    const breakfast = detail?.foodB?.trim() || null
    const lunch = detail?.foodL?.trim() || null
    const dinner = detail?.foodD?.trim() || null
    const mealBlob = [breakfast, lunch, dinner].filter(Boolean).join(' ')
    const mealEnriched = enrichScheduleMealFieldsFromText(
      { breakfastText: breakfast, lunchText: lunch, dinnerText: dinner },
      [mealBlob, breakfast, lunch, dinner],
    )
    out.push({
      day,
      title,
      description,
      routeText,
      imageKeyword: (cities[0] ?? title).slice(0, 80),
      hotelText,
      breakfastText: mealEnriched.breakfastText ?? null,
      lunchText: mealEnriched.lunchText ?? null,
      dinnerText: mealEnriched.dinnerText ?? null,
      mealSummaryText: mealEnriched.mealSummaryText ?? null,
    })
  }
  return out
}

export function extractYbtourIncludedExcluded(notice: YbtourNoticeBody | null): {
  includedItems: string[]
  excludedItems: string[]
} {
  const includedItems = htmlBulletsFromYbtourNotice(notice?.inclInfo)
  const excludedBase = htmlBulletsFromYbtourNotice(notice?.notinclInfo)
  const fees = extractYbtourFeesFromNotice(notice)
  const excludedItems = [...excludedBase]
  if (fees.singleRoomSurchargeRaw && !excludedItems.some((x) => /싱글|1인\s*객실|써차지/i.test(x))) {
    excludedItems.push(fees.singleRoomSurchargeRaw)
  }
  if (fees.guideTipRaw && !excludedItems.some((x) => /가이드|기사|팁/i.test(x))) {
    excludedItems.push(fees.guideTipRaw)
  }
  if (fees.visaNoteRaw && !excludedItems.some((x) => /비자/i.test(x))) {
    excludedItems.push(fees.visaNoteRaw)
  }
  return { includedItems, excludedItems }
}

export type YbtourFeeExtract = {
  singleRoomSurchargeRaw: string | null
  singleRoomSurchargeAmount: number | null
  guideTipRaw: string | null
  visaNoteRaw: string | null
}

export function extractYbtourFeesFromNotice(notice: YbtourNoticeBody | null): YbtourFeeExtract {
  const hay = [
    notice?.notinclInfo,
    notice?.essenInfo,
    notice?.goodsInfo,
    notice?.passportInfo,
  ]
    .map((x) => stripYbtourHtmlText(String(x ?? '')))
    .join('\n')

  let singleRoomSurchargeRaw: string | null = null
  let singleRoomSurchargeAmount: number | null = null
  let guideTipRaw: string | null = null
  let visaNoteRaw: string | null = null

  for (const line of htmlBulletsFromYbtourNotice(notice?.notinclInfo)) {
    if (!singleRoomSurchargeRaw && /(호텔\s*써차지|싱글|1인\s*객실|싱글룸|룸\s*사용)/i.test(line)) {
      singleRoomSurchargeRaw = line
      const m = line.match(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})\s*원/)
      if (m) singleRoomSurchargeAmount = Number(m[1]!.replace(/,/g, ''))
    }
    if (!guideTipRaw && /(매너팁|가이드|기사).*(팁|경비)/i.test(line)) guideTipRaw = line
  }

  if (!singleRoomSurchargeRaw) {
    const m = hay.match(/싱글[^。\n]{0,80}/i)
    if (m) singleRoomSurchargeRaw = m[0]!.trim()
  }

  const passport = stripYbtourHtmlText(String(notice?.passportInfo ?? ''))
  if (/비자/i.test(passport)) {
    const visaChunk = passport.match(/비자[^。.\n]{0,200}/i)?.[0] ?? null
    if (visaChunk) visaNoteRaw = visaChunk.trim()
  }
  if (!visaNoteRaw && /E-비자|무비자/i.test(hay)) {
    visaNoteRaw = hay.match(/(E-비자|무비자)[^。.\n]{0,120}/i)?.[0]?.trim() ?? null
  }

  return { singleRoomSurchargeRaw, singleRoomSurchargeAmount, guideTipRaw, visaNoteRaw }
}

export function extractYbtourCorePointsFromGoodsInfo(notice: YbtourNoticeBody | null): string[] {
  const bullets = htmlBulletsFromYbtourNotice(notice?.goodsInfo)
  return bullets.filter((b) => b.length > 4 && !/^https?:\/\//i.test(b)).slice(0, 12)
}

export function extractYbtourMeetingFromScheduleTm(
  scheduleDetailTm: YbtourScheduleTmRow[],
): { meetingPlaceRaw: string | null; meetingInfoRaw: string | null; meetingNoticeRaw: string | null } {
  const row = scheduleDetailTm.find(
    (r) => r.meetAirPlace?.trim() || r.meetAirTm?.trim() || r.meetAirNote?.trim(),
  )
  if (!row) {
    return { meetingPlaceRaw: null, meetingInfoRaw: null, meetingNoticeRaw: null }
  }
  const place = String(row.meetAirPlace ?? '').trim() || null
  const time = ybtourHmToDisplay(row.meetAirTm)
  const note = String(row.meetAirNote ?? '').trim() || null
  const meetingInfoRaw = [place, time ? `미팅 ${time}` : null, note].filter(Boolean).join(' · ') || null
  return { meetingPlaceRaw: place, meetingInfoRaw, meetingNoticeRaw: note }
}

export function buildYbtourFlightStructuredFromTm(
  scheduleDetailTm: YbtourScheduleTmRow[],
): FlightStructured | null {
  const row = scheduleDetailTm.find((r) => r.outFlightNm?.trim() || r.inFlightNm?.trim())
  if (!row) return null
  const depDate = ybtourYmd8ToIso(row.evStartDt)
  const arrDate = ybtourYmd8ToIso(row.evArriveDt)
  const outbound = {
    departureAirport: row.outDeprtCityNm?.trim() || null,
    departureAirportCode: null,
    departureDate: depDate,
    departureTime: ybtourHmToDisplay(row.outDeprtTm),
    arrivalAirport: row.outArrvCityNm?.trim() || null,
    arrivalAirportCode: null,
    arrivalDate: depDate,
    arrivalTime: ybtourHmToDisplay(row.outArrvTm),
    flightNo: row.outFlightNm?.trim() || null,
    durationText: null,
  }
  const inbound = {
    departureAirport: row.inDeprtCityNm?.trim() || null,
    departureAirportCode: null,
    departureDate: arrDate,
    departureTime: ybtourHmToDisplay(row.inDeprtTm),
    arrivalAirport: row.inArrvCityNm?.trim() || null,
    arrivalAirportCode: null,
    arrivalDate: arrDate,
    arrivalTime: ybtourHmToDisplay(row.inArrvTm),
    flightNo: row.inFlightNm?.trim() || null,
    durationText: null,
  }
  const hasOb = Boolean(outbound.flightNo || outbound.departureTime)
  const hasIb = Boolean(inbound.flightNo || inbound.departureTime)
  if (!hasOb && !hasIb) return null
  return {
    airlineName: null,
    outbound,
    inbound,
    rawFlightLines: [],
    debug: {
      candidateCount: 1,
      selectedOutRaw: outbound.flightNo,
      selectedInRaw: inbound.flightNo,
      partialStructured: true,
      status: hasOb && hasIb ? 'success' : 'partial',
      exposurePolicy: 'public_full',
      supplierBrandKey: 'ybtour',
      expectFlightNumber: true,
    },
    reviewNeeded: false,
    reviewReasons: [],
  }
}

function parseYbtourOptionCostText(cost: string | null | undefined): {
  adultPrice: number | null
  currency: string | null
  priceText: string | null
} {
  const priceText = String(cost ?? '').trim() || null
  if (!priceText) return { adultPrice: null, currency: null, priceText: null }
  const usd = priceText.match(/\$\s*([\d,]+(?:\.\d+)?)/)
  if (usd?.[1]) {
    const n = Number(usd[1].replace(/,/g, ''))
    return {
      adultPrice: Number.isFinite(n) ? n : null,
      currency: 'USD',
      priceText,
    }
  }
  return { adultPrice: null, currency: null, priceText }
}

/** optional-tour-detail.optionList — CIP1107 등 tour-detail에 없는 현지옵션 SSOT */
export function extractYbtourOptionalFromOptionList(
  rows: YbtourOptionListRow[],
): OptionalTourRowFields[] {
  const out: OptionalTourRowFields[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const name = String(row.title ?? '').trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    const body = [row.intro, row.note].filter(Boolean).join(' ').trim()
    const price = parseYbtourOptionCostText(row.cost)
    out.push({
      name,
      currency: price.currency,
      adultPrice: price.adultPrice,
      childPrice: null,
      durationText: row.useTm?.trim() || null,
      minPaxText: null,
      guide同行Text: null,
      waitingPlaceText: null,
      raw: [name, body, row.cost].filter(Boolean).join(' ').slice(0, 500) || name,
      priceText: price.priceText,
      alternateScheduleText: row.note?.trim() || null,
    })
  }
  return out
}

/** optional-tour-detail.shopList — notice.shopInfo가 비어 있어도 쇼핑 행 복원 */
export function extractYbtourShoppingFromShopList(rows: YbtourShopListRow[]): {
  visitCount: number | null
  rows: ShoppingStructured['rows']
  notice: string | null
} {
  const parsed: ShoppingStructured['rows'] = []
  let idx = 0
  for (const row of rows) {
    const item = String(row.shopNm ?? '').trim()
    if (!item) continue
    idx += 1
    parsed.push({
      shoppingItem: item,
      shoppingPlace: String(row.shopPlace ?? '').trim(),
      durationText: String(row.shopTm ?? '').trim(),
      refundPolicyText: String(row.refundNote ?? '').trim(),
      visitNo: idx,
      candidateOnly: false,
    })
  }
  return {
    visitCount: parsed.length > 0 ? parsed.length : null,
    rows: parsed,
    notice: parsed.length > 0 ? `쇼핑 ${parsed.length}회` : null,
  }
}

export function extractYbtourOptionalFromTourDetail(rows: YbtourTourDetailRow[]): OptionalTourRowFields[] {
  const out: OptionalTourRowFields[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const yn = String(row.trvInfoYn ?? '').toUpperCase()
    if (yn === 'Y') continue
    const name = String(row.trvInfoNm ?? '').trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    const body = String(row.trvContent ?? '').trim()
    const priceText =
      row.optCost != null && Number.isFinite(Number(row.optCost)) ? `USD ${row.optCost}` : null
    out.push({
      name,
      currency: priceText?.startsWith('USD') ? 'USD' : null,
      adultPrice: row.optCost != null ? Number(row.optCost) : null,
      childPrice: null,
      durationText: row.useTm?.trim() || null,
      minPaxText: null,
      guide同行Text: null,
      waitingPlaceText: null,
      raw: [name, body, row.refeNote].filter(Boolean).join(' ').slice(0, 500) || name,
      priceText,
      alternateScheduleText: row.refeNote?.trim() || null,
    })
  }
  return out
}

/** notice.shopInfo HTML 표 — 회차·쇼핑 품목·장소·소요시간·환불여부 */
export function extractYbtourShoppingRowsFromShopInfoHtml(
  shopInfoHtml: string | null | undefined,
): ShoppingStructured['rows'] {
  const html = String(shopInfoHtml ?? '').trim()
  if (!html) return []
  const rows: ShoppingStructured['rows'] = []
  const allRows: string[][] = []
  for (const tr of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...tr[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)]
      .map((c) => stripYbtourHtmlText(c[1]).trim())
      .filter(Boolean)
    if (cells.length >= 3) allRows.push(cells)
  }
  let dataStart = 0
  for (let i = 0; i < allRows.length; i++) {
    const head = allRows[i]!.join(' ')
    if (/회차/.test(head) && /쇼핑\s*품목|품목/.test(head)) {
      dataStart = i + 1
      break
    }
  }
  for (let i = dataStart; i < allRows.length; i++) {
    const cols = allRows[i]!
    if (cols.length < 4) continue
    const visitNo = Number(String(cols[0]).replace(/[^\d]/g, '') || NaN)
    if (!Number.isFinite(visitNo) || visitNo < 1 || visitNo > 99) continue
    rows.push({
      shoppingItem: cols[1] ?? '',
      shoppingPlace: cols[2] ?? '',
      durationText: cols[3] ?? '',
      refundPolicyText: cols.slice(4).join(' ').trim(),
      visitNo,
      candidateOnly: false,
    })
  }
  return rows
}

export function extractYbtourShoppingFromNoticeAndSchedule(
  notice: YbtourNoticeBody | null,
  scheduleDetailTm: YbtourScheduleTmRow[],
): { visitCount: number | null; rows: ShoppingStructured['rows']; notice: string | null } {
  const shopCnt = Number(notice?.shopCnt)
  let visitCount = Number.isFinite(shopCnt) && shopCnt >= 0 ? shopCnt : null
  const rows: ShoppingStructured['rows'] = extractYbtourShoppingRowsFromShopInfoHtml(notice?.shopInfo)
  let idx = rows.length
  for (const tm of scheduleDetailTm) {
    if (rows.length > 0) break
    const hay = `${tm.tmTitle ?? ''} ${stripYbtourHtmlText(String(tm.tmContent ?? ''))}`
    if (!/쇼핑\s*센터|쇼핑센터/i.test(hay)) continue
    idx += 1
    rows.push({
      shoppingItem: '쇼핑',
      shoppingPlace: '쇼핑센터',
      durationText: '',
      refundPolicyText: '',
      visitNo: idx,
      candidateOnly: false,
    })
  }
  const shopInfoText = stripYbtourHtmlText(String(notice?.shopInfo ?? ''))
  if (visitCount == null) {
    const fromInfo = parseYbtourShoppingVisitCount(shopInfoText)
    if (fromInfo != null) visitCount = fromInfo
  }
  if (visitCount == null && rows.length > 0) visitCount = rows.length
  const shopNotice = notice?.shopInfo ? shopInfoText.slice(0, 400) : null
  return { visitCount, rows, notice: shopNotice }
}

export function optionalRowsToStructuredJson(rows: OptionalTourRowFields[]): string | null {
  if (rows.length === 0) return null
  const structured = rows.map((r) => ({
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
  }))
  return JSON.stringify(structured)
}

export function shoppingRowsToStopsJson(rows: ShoppingStructured['rows']): string | null {
  if (rows.length === 0) return null
  const stops = rows.map((r) => shoppingStructuredRowToPersistStop(r))
  return JSON.stringify(stops)
}

export async function fetchYbtourRegisterDetailBundle(
  originUrl: string,
  opts?: { includeOptShop?: boolean },
): Promise<YbtourRegisterDetailBundle | null> {
  const evCd = parseYbtourEvCdFromUrl(originUrl)
  if (!evCd) return null
  const goodsCd = resolveYbtourGoodsCdForApi(originUrl) ?? parseYbtourEvCdFromUrl(originUrl)?.split('-')[0]
  if (!goodsCd) return null

  const referer =
    originUrl.trim() || `https://prdt.ybtour.co.kr/product/detailPackage?evCd=${encodeURIComponent(evCd)}`

  const notice = await fetchYbtourRegisterPapiJson<YbtourNoticeBody>(
    `/pkg/event/${encodeURIComponent(evCd)}/notice`,
    referer,
  )
  await paceBetweenRegisterDetailFetches()

  const schedule = await fetchYbtourRegisterPapiJson<YbtourScheduleBody>(
    `/pkg/event-schedule/${encodeURIComponent(evCd)}/${encodeURIComponent(goodsCd)}`,
    referer,
  )
  await paceBetweenRegisterDetailFetches()

  const tourDetail = await fetchYbtourRegisterPapiJson<YbtourTourDetailRow[]>(
    `/pkg/event-schedule/${encodeURIComponent(evCd)}/tour-detail`,
    referer,
  )

  let optionalTourDetail: YbtourOptionalTourDetailBody | null = null
  if (opts?.includeOptShop) {
    await paceBetweenRegisterDetailFetches()
    optionalTourDetail = await fetchYbtourRegisterPapiJson<YbtourOptionalTourDetailBody>(
      `/pkg/event-schedule/${encodeURIComponent(evCd)}/optional-tour-detail`,
      referer,
    )
  }

  if (!notice && !schedule && !tourDetail && !optionalTourDetail) return null
  return { notice, schedule, tourDetail, optionalTourDetail }
}
