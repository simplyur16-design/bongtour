/**
 * 하나투어 등록 상세카드 — gw API 응답 파싱 SSOT.
 *
 * REGRESSION-FREEZE[hanatour-register-detail-collect]: getPkgProdInfo·getPkgProdItnrInfo·getPkgProdChcStsngInfo 매핑 — manifest
 */
import {
  fetchHanatourPkgProdInfo,
  hanatourDepartureAirportLabelFromCodes,
  hanatourYmdFromDepDay,
  parseHanatourPkgCdFromUrl,
  type HanatourPkgProdInfo,
} from '@/lib/hanatour-api-departures'
import type { FlightStructured } from '@/lib/detail-body-parser-types'
import type { RegisterFactScheduleDay } from '@/lib/register-facts/types'
import type { OptionalTourRowFields } from '@/lib/optional-tour-row-gate-hanatour'
import type { ShoppingStructured } from '@/lib/detail-body-parser-types'
import type { RegisterScheduleDay } from '@/lib/register-llm-schema-hanatour'
import { parseFactMealsListToScheduleFields } from '@/lib/register-schedule-meal-parse'
import { shoppingStructuredRowToPersistStop } from '@/lib/shopping-structured-row-to-persist'
import { addDaysUtcYmd } from '@/lib/calendar-ymd'

const HANATOUR_GW_BASE = process.env.HANATOUR_GW_BASE_URL ?? 'https://gw.hanatour.com'
const HANATOUR_TRP_PRG_MID = 'CHPC0PKG0200M200'

function hanatourGwHeaders(): HeadersInit {
  return {
    accept: 'application/json, text/plain, */*',
    'content-type': 'application/json',
    referer: 'https://www.hanatour.com/',
    prgmid: HANATOUR_TRP_PRG_MID,
  }
}

async function postHanatourGw<T>(path: string, body: unknown): Promise<T | null> {
  const res = await fetch(`${HANATOUR_GW_BASE}${path}?_siteId=hanatour`, {
    method: 'POST',
    headers: hanatourGwHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  })
  if (!res.ok) return null
  return (await res.json()) as T
}

export type HanatourTrvlExpnRow = {
  trvlExpnClstNm?: string | null
  trvlExpnDesc?: string | null
  trvlExpnNm?: string | null
}

export type HanatourItnrCmsInfoRow = {
  cmsCntntNm?: string | null
  cmsCntntCont?: string | null
}

export type HanatourItnrSchdMain = {
  schdCatgNm?: string | null
  schdCont?: string | null
  schdTitlNm?: string | null
  cardNm?: string | null
  cardCntntPc?: string | null
  cardCntntMbl?: string | null
  schdRqrmHm?: string | null
  depCityNm?: string | null
  arriveCityNm?: string | null
  trfcMensNm?: string | null
  dtlMealDvNm?: string | null
  mealCont?: string | null
  cmsInfoList?: HanatourItnrCmsInfoRow[] | null
}

export type HanatourItnrSchdDay = {
  schdDay?: number
  schdMainInfoList?: HanatourItnrSchdMain[]
}

export type HanatourItnrResponse = {
  data?: {
    meetInfoBcVo?: { fstMeetCont?: string | null }
    schdInfoList?: HanatourItnrSchdDay[]
  }
}

export type HanatourChcStsngRow = {
  koCntryNm?: string | null
  koCityNm?: string | null
  chcStsngCd?: string | null
  spclStsngYn?: string | null
  chcStsngNm?: string | null
  currCd?: string | null
  adtAmt?: number | null
  chdAmt?: number | null
  rqrmTmInfo?: string | null
  chcStsngCont?: string | null
  sbstSchdCont?: string | null
  mrchRcmnYn?: string | null
}

export type HanatourChcStsngResponse = {
  data?: {
    chcInfoList?: HanatourChcStsngRow[]
    bestChcTourYn?: string | null
  }
}

export type HanatourCorePointRow = {
  corePntSeq?: number
  corePntType?: string | null
  corePntTitlNm?: string | null
  corePntCont?: string | null
}

export type HanatourPkgAirSeqRow = {
  schdSeq?: number
  segSeq?: string | null
  airlCd?: string | null
  airlNm?: string | null
  flgtNm?: string | null
  depHm?: string | null
  arrHm?: string | null
  depAptCd?: string | null
  depAptNm?: string | null
  depAptCityNm?: string | null
  arrAptCd?: string | null
  arrAptNm?: string | null
  arrAptCityNm?: string | null
  depBassFlxbDt?: string | null
  arrBassFlxbDt?: string | null
}

export type HanatourProdInfoExtended = HanatourPkgProdInfo & {
  trvlDayCnt?: number | null
  trvlNgtCnt?: number | null
  smplSchdCont?: string | null
  trvlExpnInclList?: HanatourTrvlExpnRow[]
  trvlExpnNoneInclList?: HanatourTrvlExpnRow[]
  trvlChcExpnList?: HanatourTrvlExpnRow[]
  shpnInfoList?: Array<Record<string, unknown>>
  shpnCntrVistCnt?: number
  shpnInfoCont?: string | null
  snglAddAmt?: number | null
  snglAddAmtDesc?: string | null
  guideExpnAmt?: number | null
  guideExpnCurrCd?: string | null
  pntCont?: string | null
  exprWrdngCont2?: string | null
  bnftInfoList?: HanatourCorePointRow[]
  rppdCntntInfoList?: HanatourCorePointRow[]
  agtRmkCont?: string | null
  noptYn?: string | null
  pkgAirSeqList?: HanatourPkgAirSeqRow[]
  depAirCd?: string | null
  arrFlgtCd?: string | null
  depCityNm?: string | null
  arrCityNm?: string | null
}

const HANATOUR_SCHEDULE_HIGHLIGHT_MAX = 7
const HANATOUR_FACT_DESCRIPTION_MAX = 320
const HANATOUR_FACT_DESCRIPTION_MIN_SENTENCES = 2
const HANATOUR_FACT_DESCRIPTION_MAX_SENTENCES = 4

const HANATOUR_HIGHLIGHT_NOISE_RE =
  /최신$|^(?:마카오|홍콩)$|_벽화$|^\d+$|NO\.?\s*\d|자유식\s*추천|추천\s*선택관광|야시장\s*투어$/i

function normalizeHanatourHighlightKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/\s*\(new\)\s*/gi, '')
    .replace(/[^a-z0-9가-힣]/g, '')
}

function isHanatourHighlightNoise(label: string): boolean {
  const t = label.trim()
  if (!t || t.length < 2) return true
  if (HANATOUR_HIGHLIGHT_NOISE_RE.test(t)) return true
  if (/^HELLO[\s,]/i.test(t)) return true
  if (/^Hong Kong$/i.test(t)) return true
  return false
}

function cleanHanatourHighlightLabel(label: string): string {
  return label
    .replace(/\s*\(NEW\)\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreHanatourHighlight(label: string): number {
  const t = cleanHanatourHighlightLabel(label)
  if (t.length < 3) return -10
  if (/^(?:마카오|홍콩)$/i.test(t)) return -5
  if (t.length <= 6) return 1
  if (t.length <= 36) return 6
  return 4
}

/** itnr places — 중복·에셋명 제거 후 순서 유지. routeText·하이라이트 SSOT. */
export function dedupeHanatourFactDayPlaces(places: string[]): string[] {
  const out: string[] = []
  const keys: string[] = []
  for (const raw of places) {
    const label = cleanHanatourHighlightLabel(String(raw ?? ''))
    if (!label || isHanatourHighlightNoise(label)) continue
    const key = normalizeHanatourHighlightKey(label)
    if (!key) continue
    const dupIdx = keys.findIndex(
      (k) => k === key || (k.length >= 4 && key.includes(k)) || (key.length >= 4 && k.includes(key)),
    )
    if (dupIdx >= 0) {
      if (label.length > out[dupIdx]!.length) out[dupIdx] = label
      continue
    }
    keys.push(key)
    out.push(label)
  }
  return out
}

/** 일정 요약·title — 핵심 관광지 최대 7개. REGRESSION-FREEZE[hanatour-register-detail-collect] */
export function selectHanatourScheduleHighlights(places: string[], max = HANATOUR_SCHEDULE_HIGHLIGHT_MAX): string[] {
  const deduped = dedupeHanatourFactDayPlaces(places)
  return [...deduped]
    .map((label, idx) => ({ label, idx, score: scoreHanatourHighlight(label) }))
    .sort((a, b) => b.score - a.score || a.idx - b.idx)
    .slice(0, max)
    .sort((a, b) => a.idx - b.idx)
    .map((x) => x.label)
}

function hanatourCountKrSentences(text: string): number {
  const t = text.replace(/\r/g, ' ').replace(/\s+/g, ' ').trim()
  if (!t) return 0
  const parts = t.split(/(?<=[.!?…])\s+/).filter(Boolean)
  return parts.length > 0 ? parts.length : 1
}

function joinHanatourHighlightPhrase(highlights: string[], from: number, to: number): string {
  return highlights
    .slice(from, to)
    .map((x) => x.trim())
    .filter(Boolean)
    .join(', ')
}

/** fact day → 2~4문장 일정 설명(장문 dump·식사·호텔명 제외). REGRESSION-FREEZE[hanatour-register-detail-collect] */
export function composeHanatourFactDayDescription(
  day: RegisterFactScheduleDay,
  maxDay: number,
  highlights: string[],
): string {
  const transport = String(day.transportNote ?? '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
  const joined = [transport.join(' '), ...highlights].join(' ')
  const lead = highlights[0] ?? transport[0] ?? `${day.day}일차`
  const mid = joinHanatourHighlightPhrase(highlights, 1, 4)
  const tail = joinHanatourHighlightPhrase(highlights, 4, HANATOUR_SCHEDULE_HIGHLIGHT_MAX)
  const sentences: string[] = []

  if (day.day === 1 && /인천|ICN/.test(joined) && /홍콩|HKG|마카오|MFM|현지/.test(joined)) {
    sentences.push(
      `인천에서 출발해 현지에 도착한 뒤 ${lead}${mid ? `, ${mid}` : ''} 등 핵심 코스를 순서대로 둘러봅니다.`,
    )
  } else if (day.day === maxDay && maxDay >= 2 && /인천|ICN|귀국|출국/.test(joined)) {
    sentences.push(`${lead}${mid ? `·${mid}` : ''} 일정을 마친 뒤 인천으로 귀국합니다.`)
  } else if (/마카오|MFM/.test(joined) && /홍콩|HKG/.test(joined)) {
    sentences.push(
      `홍콩에서 마카오로 이동해 ${joinHanatourHighlightPhrase(highlights, 0, 3) || lead} 등을 둘러본 뒤 홍콩으로 복귀합니다.`,
    )
    if (mid) sentences.push(`오후에는 ${mid} 등 홍콩 시내 일정을 이어갑니다.`)
  } else if (transport.length > 0) {
    sentences.push(`${transport.join(' → ')} 구간을 중심으로 ${lead}${mid ? `, ${mid}` : ''} 등을 방문합니다.`)
  } else {
    sentences.push(`${lead}${mid ? `, ${mid}` : ''} 등 주요 명소를 순서대로 둘러보는 관광 일정입니다.`)
  }

  if (tail && sentences.length < HANATOUR_FACT_DESCRIPTION_MAX_SENTENCES) {
    sentences.push(`추가로 ${tail} 등도 포함됩니다.`)
  }

  let out = sentences.slice(0, HANATOUR_FACT_DESCRIPTION_MAX_SENTENCES).join(' ')
  if (hanatourCountKrSentences(out) < HANATOUR_FACT_DESCRIPTION_MIN_SENTENCES && highlights.length >= 2) {
    out = `${out} ${lead}와 ${highlights[1]}를 중심으로 당일 동선을 마무리합니다.`.trim()
  }
  return out.replace(/\s+/g, ' ').trim().slice(0, HANATOUR_FACT_DESCRIPTION_MAX)
}

function hanatourProdInfoCorePointRows(info: HanatourProdInfoExtended): HanatourCorePointRow[] {
  const bnft = info.bnftInfoList ?? []
  if (bnft.length > 0) return bnft
  return info.rppdCntntInfoList ?? []
}

function extractHanatourHotelSummaryFromProdInfo(info: HanatourProdInfoExtended): string | null {
  for (const row of hanatourProdInfoCorePointRows(info)) {
    const body = stripHanatourHtmlText(String(row.corePntCont ?? ''))
    const m = body.match(/([가-힣]{2,14}\s*\d\s*성\s*호텔)/i)
      ?? body.match(/([가-힣][가-힣A-Za-z0-9+\s]{1,24}(?:\d\s*성\s*)?호텔)/i)
    if (m?.[1]) return m[1].replace(/\s+/g, ' ').trim()
  }
  const title = String(info.saleProdNm ?? '')
  const hashParts = [...title.matchAll(/#([^#]+)/g)]
    .map((m) => m[1]?.trim())
    .filter((x) => x && /호텔|리조트|숙박/i.test(x))
  if (hashParts.length > 0) return hashParts[0]!.slice(0, 120)
  const smpl = String(info.smplSchdCont ?? '').trim()
  if (smpl && /홍콩|마카오|오사카|도쿄|방콕|다낭/.test(smpl)) {
    const city = smpl.match(/^([가-힣A-Za-z]+)/)?.[1]
    if (city) return `${city} 예정 호텔(동급 가능)`
  }
  return null
}

function isHanatourReturnDayWithoutHotel(day: RegisterFactScheduleDay, maxDay: number): boolean {
  if (day.day !== maxDay || maxDay < 2) return false
  const blob = `${day.transportNote ?? ''} ${day.places.join(' ')}`
  return /인천|ICN|김포|GMP|귀국|출국/.test(blob)
}

/** itnr에 숙박 행이 없을 때 prodInfo 핵심포인트·제목 해시로 일차 hotelText 보강. */
export function applyHanatourProdInfoHotelsToFactDays(
  days: RegisterFactScheduleDay[],
  info: HanatourProdInfoExtended | null | undefined,
): RegisterFactScheduleDay[] {
  if (!days.length || !info) return days
  const summary = extractHanatourHotelSummaryFromProdInfo(info)
  if (!summary) return days
  const maxDay = Math.max(...days.map((d) => d.day))
  return days.map((d) => {
    if (d.hotels.length > 0) return d
    if (isHanatourReturnDayWithoutHotel(d, maxDay)) {
      return { ...d, hotels: ['숙박 없음(귀국)'] }
    }
    return { ...d, hotels: [summary] }
  })
}

export function stripHanatourHtmlText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function formatHanatourTrvlExpnBullet(row: HanatourTrvlExpnRow): string {
  const desc = stripHanatourHtmlText(String(row.trvlExpnDesc ?? row.trvlExpnNm ?? ''))
  const clst = String(row.trvlExpnClstNm ?? '').trim()
  if (!desc) return ''
  if (clst && !desc.startsWith(clst)) return `${clst} ${desc}`.trim()
  return desc
}

export function hanatourFactDaysToRegisterSchedule(days: RegisterFactScheduleDay[]): RegisterScheduleDay[] {
  const maxDay = days.reduce((m, d) => Math.max(m, d.day), 0)
  return days.map((d) => {
    const places = dedupeHanatourFactDayPlaces(d.places)
    const highlights = selectHanatourScheduleHighlights(places)
    const firstTransport = (d.transportNote ?? '').split(';').map((s) => s.trim()).find(Boolean) ?? ''
    const title =
      (highlights.length > 0 ? highlights.join(' - ') : '') ||
      firstTransport ||
      (d.hotels[0] ?? '').trim() ||
      `${d.day}일차`
    const description =
      composeHanatourFactDayDescription(d, maxDay, highlights) ||
      title
    const routeText =
      places.length > 0
        ? places.join(' - ')
        : firstTransport.includes(' - ')
          ? firstTransport
          : null
    const hotelText = d.hotels.length > 0 ? d.hotels.join(' / ') : null
    const meals = parseFactMealsListToScheduleFields(d.meals)
    return {
      day: d.day,
      title,
      description,
      routeText,
      imageKeyword: '',
      hotelText,
      breakfastText: meals.breakfastText ?? null,
      lunchText: meals.lunchText ?? null,
      dinnerText: meals.dinnerText ?? null,
      mealSummaryText: meals.mealSummaryText ?? null,
    }
  })
}

function parseCardOptionalFields(card: HanatourItnrSchdMain): Partial<OptionalTourRowFields> {
  const name = String(card.cardNm ?? card.schdTitlNm ?? '').trim()
  const html = String(card.cardCntntPc ?? card.cardCntntMbl ?? '')
  const text = stripHanatourHtmlText(html)
  const priceM = text.match(/요금\s*:\s*성인\s*(\d+)\s*([A-Z]{3})(?:\s*\/\s*아동\s*(\d+))?/i)
  const durationM = text.match(/소요시간\s*:\s*([^]+?)(?=대체일정|미선택|$)/i)
  const altM = text.match(/대체일정\s*:\s*([^]+?)(?=미선택|$)/i)
  const guideM = text.match(/미선택시\s*가이드동행\s*:\s*(\S+)/i)
  return {
    name,
    currency: priceM?.[2]?.toUpperCase() ?? null,
    adultPrice: priceM ? Number(priceM[1]) : null,
    childPrice: priceM?.[3] ? Number(priceM[3]) : priceM ? Number(priceM[1]) : null,
    durationText: durationM?.[1]?.trim() ?? (card.schdRqrmHm ? `${card.schdRqrmHm}분` : null),
    alternateScheduleText: altM?.[1]?.trim() ?? null,
    guide同行Text: guideM?.[1] ?? null,
    raw: text.slice(0, 500) || name,
    priceText: priceM ? `성인 ${priceM[1]}${priceM[2]}` : null,
  }
}

function normalizeHanatourOptionalTourDisplayName(raw: string): string {
  let name = String(raw ?? '').trim()
  while (/^\s*\[[^\]]+\]\s*/.test(name)) {
    name = name.replace(/^\s*\[[^\]]+\]\s*/, '')
  }
  name = name.replace(/^\s*(MD추천|스페셜포함)\s*/i, '').trim()
  return name
}

export function extractHanatourOptionalToursFromChcStsng(
  chc: HanatourChcStsngResponse | null,
): OptionalTourRowFields[] {
  const out: OptionalTourRowFields[] = []
  const seen = new Set<string>()
  for (const row of chc?.data?.chcInfoList ?? []) {
    const name = normalizeHanatourOptionalTourDisplayName(String(row.chcStsngNm ?? ''))
    if (!name || seen.has(name)) continue
    seen.add(name)
    const currency = String(row.currCd ?? '').trim().toUpperCase() || null
    const adultPrice = Number.isFinite(Number(row.adtAmt)) ? Number(row.adtAmt) : null
    const childPrice = Number.isFinite(Number(row.chdAmt)) ? Number(row.chdAmt) : null
    const tags: string[] = []
    if (String(row.spclStsngYn ?? '').toUpperCase() === 'Y') tags.push('스페셜포함')
    if (String(row.mrchRcmnYn ?? '').toUpperCase() === 'Y') tags.push('MD추천')
    out.push({
      name,
      currency,
      adultPrice,
      childPrice,
      durationText: String(row.rqrmTmInfo ?? '').trim() || null,
      minPaxText: null,
      guide同行Text: null,
      waitingPlaceText: null,
      raw: stripHanatourHtmlText(String(row.chcStsngCont ?? row.chcStsngNm ?? '')).slice(0, 500) || name,
      priceText:
        adultPrice != null && currency ? `성인 ${adultPrice}${currency}` : null,
      alternateScheduleText: String(row.sbstSchdCont ?? '').trim() || null,
      supplierTags: tags.length > 0 ? tags : null,
      includedNoExtraCharge: String(row.spclStsngYn ?? '').toUpperCase() === 'Y' ? true : null,
    })
  }
  return out
}

export function extractHanatourOptionalToursFromItnr(itnr: HanatourItnrResponse | null): OptionalTourRowFields[] {
  const out: OptionalTourRowFields[] = []
  const seen = new Set<string>()
  for (const dayRow of itnr?.data?.schdInfoList ?? []) {
    for (const main of dayRow.schdMainInfoList ?? []) {
      const cat = String(main.schdCatgNm ?? '')
      if (!cat.includes('선택관광')) continue
      const fields = parseCardOptionalFields(main)
      const name = normalizeHanatourOptionalTourDisplayName(fields.name ?? '')
      if (!name || seen.has(name)) continue
      seen.add(name)
      out.push({
        name,
        currency: fields.currency ?? null,
        adultPrice: fields.adultPrice ?? null,
        childPrice: fields.childPrice ?? null,
        durationText: fields.durationText ?? null,
        minPaxText: null,
        guide同行Text: fields.guide同行Text ?? null,
        waitingPlaceText: null,
        raw: fields.raw ?? name,
        priceText: fields.priceText ?? null,
        alternateScheduleText: fields.alternateScheduleText ?? null,
      })
    }
  }
  return out
}

/** 선택관광 SSOT: chcInfoList(전체 카탈로그) 우선, 없으면 itnr 일정 카드 */
export function extractHanatourOptionalTours(bundle: {
  itnr: HanatourItnrResponse | null
  chcStsng: HanatourChcStsngResponse | null
}): OptionalTourRowFields[] {
  const fromChc = extractHanatourOptionalToursFromChcStsng(bundle.chcStsng)
  if (fromChc.length > 0) return fromChc
  return extractHanatourOptionalToursFromItnr(bundle.itnr)
}

export function extractHanatourShoppingFromProdInfo(info: HanatourProdInfoExtended): {
  visitCount: number | null
  rows: ShoppingStructured['rows']
  notice: string | null
} {
  const visitCount = Number.isFinite(Number(info.shpnCntrVistCnt)) ? Number(info.shpnCntrVistCnt) : null
  const rows: ShoppingStructured['rows'] = []
  for (const row of info.shpnInfoList ?? []) {
    const place = String(row.shpnPlcNm ?? row.shpnShopNm ?? '').trim()
    const item = String(row.shpnItemNm ?? row.shpnGdsNm ?? '').trim()
    if (!place && !item) continue
    rows.push({
      shoppingItem: item || place,
      shoppingPlace: place || item,
      durationText: String(row.shpnReqrTm ?? row.shpnTm ?? '').trim(),
      refundPolicyText: String(row.shpnRfndPsblYnNm ?? row.shpnRfndCont ?? '').trim(),
      city: String(row.shpnCityNm ?? '').trim() || null,
      shopName: place || null,
    })
  }
  return {
    visitCount,
    rows,
    notice: info.shpnInfoCont ? stripHanatourHtmlText(info.shpnInfoCont).slice(0, 400) : null,
  }
}

export type HanatourFeeExtract = {
  singleRoomSurchargeRaw: string | null
  singleRoomSurchargeAmount: number | null
  guideTipRaw: string | null
  mandatoryLocalFee: number | null
  mandatoryCurrency: string | null
  visaNoteRaw: string | null
}

export function extractHanatourFeesFromProdInfo(info: HanatourProdInfoExtended): HanatourFeeExtract {
  const bullets = [
    ...(info.trvlExpnNoneInclList ?? []).map(formatHanatourTrvlExpnBullet),
    ...(info.trvlChcExpnList ?? []).map(formatHanatourTrvlExpnBullet),
  ].filter(Boolean)

  let singleRoomSurchargeRaw = info.snglAddAmtDesc?.trim() || null
  let singleRoomSurchargeAmount =
    Number.isFinite(Number(info.snglAddAmt)) && Number(info.snglAddAmt) > 0 ? Number(info.snglAddAmt) : null

  let guideTipRaw: string | null = null
  let mandatoryLocalFee: number | null = null
  let mandatoryCurrency: string | null = null
  let visaNoteRaw: string | null = null

  for (const b of bullets) {
    if (!singleRoomSurchargeRaw && /(싱글|1인\s*객실|객실\s*1인)/i.test(b)) {
      singleRoomSurchargeRaw = b
      const m = b.match(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})\s*원/)
      if (m) singleRoomSurchargeAmount = Number(m[1]!.replace(/,/g, ''))
    }
    if (!guideTipRaw && /(가이드|기사).*(경비|팁)/i.test(b)) {
      guideTipRaw = b
      const m = b.match(/([A-Z]{3})\s*(\d+)|(\d+)\s*([A-Z]{3})/i)
      if (m) {
        mandatoryCurrency = (m[1] ?? m[4] ?? 'USD').toUpperCase()
        mandatoryLocalFee = Number(m[2] ?? m[3])
      }
    }
    if (!visaNoteRaw && /비자/i.test(b)) visaNoteRaw = b
  }

  if (!guideTipRaw && Number.isFinite(Number(info.guideExpnAmt)) && Number(info.guideExpnAmt) > 0) {
    mandatoryCurrency = String(info.guideExpnCurrCd ?? 'USD').toUpperCase()
    mandatoryLocalFee = Number(info.guideExpnAmt)
    guideTipRaw = `가이드/기사 경비: 인당 ${mandatoryLocalFee} ${mandatoryCurrency}`
  }

  const agt = info.agtRmkCont ? stripHanatourHtmlText(info.agtRmkCont) : ''
  if (!visaNoteRaw && /비자/i.test(agt)) {
    const visaChunk = agt.match(/비자[^。.\n]{0,200}/i)?.[0] ?? null
    if (visaChunk) visaNoteRaw = visaChunk.trim()
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

export function extractHanatourIncludedExcluded(info: HanatourProdInfoExtended): {
  includedItems: string[]
  excludedItems: string[]
} {
  const includedItems = (info.trvlExpnInclList ?? []).map(formatHanatourTrvlExpnBullet).filter(Boolean)
  const excludedBase = (info.trvlExpnNoneInclList ?? []).map(formatHanatourTrvlExpnBullet).filter(Boolean)
  const choice = (info.trvlChcExpnList ?? []).map(formatHanatourTrvlExpnBullet).filter(Boolean)
  const excludedItems = [...excludedBase, ...choice]
  const fees = extractHanatourFeesFromProdInfo(info)
  if (fees.guideTipRaw && !excludedItems.some((x) => x.includes(fees.guideTipRaw!.slice(0, 12)))) {
    excludedItems.push(fees.guideTipRaw)
  }
  if (fees.singleRoomSurchargeRaw && !excludedItems.some((x) => /객실|싱글/i.test(x))) {
    excludedItems.push(fees.singleRoomSurchargeRaw)
  }
  if (fees.visaNoteRaw && !excludedItems.some((x) => /비자/i.test(x))) {
    excludedItems.push(fees.visaNoteRaw)
  }
  return { includedItems, excludedItems }
}

export function extractHanatourCorePoints(info: HanatourProdInfoExtended): Array<{
  category: '안전/유의' | '현지준비' | '입국/비자'
  title: string
  body: string
}> {
  const out: Array<{ category: '안전/유의' | '현지준비' | '입국/비자'; title: string; body: string }> = []
  const push = (category: '안전/유의' | '현지준비' | '입국/비자', title: string, body: string) => {
    const b = stripHanatourHtmlText(body)
    if (!b) return
    out.push({ category, title: title.trim() || category, body: b })
  }
  for (const row of hanatourProdInfoCorePointRows(info)) {
    const title = String(row.corePntTitlNm ?? row.corePntType ?? '핵심포인트').trim()
    const body = String(row.corePntCont ?? '').trim()
    if (!body) continue
    const type = String(row.corePntType ?? '')
    const cat = /비자|입국/.test(title + body) ? '입국/비자' : /보험|SAFETY|안전/.test(type + title) ? '안전/유의' : '현지준비'
    push(cat, title, body)
  }
  if (info.exprWrdngCont2?.trim()) push('현지준비', '상품 핵심', info.exprWrdngCont2)
  if (info.pntCont?.trim() && info.pntCont !== '관광') push('현지준비', '포인트', info.pntCont)
  return out
}

export function optionalRowsToStructuredJson(rows: OptionalTourRowFields[]): string | null {
  if (rows.length === 0) return null
  return JSON.stringify(
    rows.map((r) => ({
      name: r.name,
      currency: r.currency,
      priceAdult: r.adultPrice,
      priceChild: r.childPrice,
      duration: r.durationText,
      alternativeProgram: r.alternateScheduleText,
      description: r.raw,
    })),
  )
}

export function shoppingRowsToStopsJson(rows: ShoppingStructured['rows']): string | null {
  if (rows.length === 0) return null
  return JSON.stringify(rows.map((r) => shoppingStructuredRowToPersistStop(r)))
}

const HANATOUR_ITNR_PLACE_NOISE_RE =
  /주의사항|여행\s*정보|여행\s*주의|자유식\s*추천|추천식당|^HELLO[\s,]/i

function isHanatourItnrNoisePlaceLabel(label: string): boolean {
  const t = label.trim()
  if (!t || t.length < 2) return true
  if (HANATOUR_ITNR_PLACE_NOISE_RE.test(t)) return true
  if (/^Hong Kong$/i.test(t)) return true
  return false
}

function pushHanatourItnrUniqueLabel(out: string[], raw: string | null | undefined): void {
  const t = String(raw ?? '').trim()
  if (!t || isHanatourItnrNoisePlaceLabel(t)) return
  if (out.some((x) => x === t)) return
  out.push(t.slice(0, 200))
}

/** getPkgProdItnrInfo — schdTitlNm 비어 있어도 cardNm·cmsInfoList·mealCont·도시 이동에서 추출.
 * REGRESSION-FREEZE[hanatour-register-detail-collect]: itnr card field mapping — manifest */
export function hanatourItnrMealLine(main: HanatourItnrSchdMain): string | null {
  const slot = String(main.dtlMealDvNm ?? '').trim()
  const cont = String(main.mealCont ?? '').trim()
  if (slot && cont) return `${slot} ${cont}`.slice(0, 160)
  return slot || cont || null
}

export function hanatourItnrTransportLine(main: HanatourItnrSchdMain): string | null {
  const dep = String(main.depCityNm ?? '').trim()
  const arr = String(main.arriveCityNm ?? '').trim()
  if (dep && arr && dep !== arr) return `${dep} - ${arr}`.slice(0, 120)
  if (dep) return dep.slice(0, 120)
  if (arr) return arr.slice(0, 120)
  const trfc = String(main.trfcMensNm ?? '').trim()
  return trfc || null
}

export function hanatourItnrPlaceLabels(main: HanatourItnrSchdMain): string[] {
  const out: string[] = []
  pushHanatourItnrUniqueLabel(out, stripHanatourHtmlText(String(main.schdTitlNm ?? main.schdCont ?? '')))
  pushHanatourItnrUniqueLabel(out, String(main.cardNm ?? ''))
  for (const cms of main.cmsInfoList ?? []) {
    pushHanatourItnrUniqueLabel(out, String(cms.cmsCntntNm ?? ''))
  }
  const html = String(main.cardCntntPc ?? main.cardCntntMbl ?? '')
  for (const m of html.matchAll(/alt="([^"]{2,48})"/gi)) {
    pushHanatourItnrUniqueLabel(out, m[1])
  }
  for (const m of html.matchAll(/<strong[^>]*>([^<]{2,80})<\/strong>/gi)) {
    pushHanatourItnrUniqueLabel(out, stripHanatourHtmlText(m[1]!))
  }
  return out
}

export function hanatourItnrSchdToFactDays(schdInfoList: HanatourItnrSchdDay[]): RegisterFactScheduleDay[] {
  const rows: RegisterFactScheduleDay[] = []
  for (const dayRow of schdInfoList) {
    const day = Number(dayRow.schdDay ?? 0)
    if (!Number.isFinite(day) || day <= 0) continue
    const fact: RegisterFactScheduleDay = {
      day,
      places: [],
      hotels: [],
      meals: [],
      transportNote: null,
    }
    for (const main of dayRow.schdMainInfoList ?? []) {
      const cat = String(main.schdCatgNm ?? '').trim()
      if (cat.includes('식사')) {
        const meal = hanatourItnrMealLine(main)
        if (meal) fact.meals.push(meal)
        continue
      }
      if (cat.includes('선택관광')) continue
      if (cat.includes('이동') || cat.includes('항공') || cat.includes('도시')) {
        const transport = hanatourItnrTransportLine(main)
        if (transport) {
          fact.transportNote = fact.transportNote ? `${fact.transportNote}; ${transport}` : transport
        }
        continue
      }
      const labels = hanatourItnrPlaceLabels(main)
      if (cat.includes('숙박') || cat.includes('호텔')) {
        for (const label of labels) fact.hotels.push(label)
        continue
      }
      for (const label of labels) fact.places.push(label)
    }
    rows.push(fact)
  }
  return rows.sort((a, b) => a.day - b.day)
}

export function hanatourItnrToFactDays(itnr: HanatourItnrResponse | null): RegisterFactScheduleDay[] {
  return hanatourItnrSchdToFactDays(itnr?.data?.schdInfoList ?? [])
}

export async function fetchHanatourPkgProdChcStsngInfo(pkgCd: string): Promise<HanatourChcStsngResponse | null> {
  return postHanatourGw<HanatourChcStsngResponse>(
    '/package/pkg/api/common/pkgcomprod/getPkgProdChcStsngInfo/v1.00',
    { pkgCd },
  )
}

function hanatourHmToDisplay(hm: string | null | undefined): string | null {
  const s = String(hm ?? '').trim()
  if (!/^\d{4}$/.test(s)) return s || null
  return `${s.slice(0, 2)}:${s.slice(2, 4)}`
}

function hanatourFlightNo(airlCd?: string | null, flgtNm?: string | null): string | null {
  const cd = String(airlCd ?? '').trim()
  const nm = String(flgtNm ?? '').trim()
  if (!cd && !nm) return null
  if (cd && nm) return `${cd}${nm}`
  return cd || nm
}

function hanatourLegDate(baseYmd: string | null, offsetRaw: string | null | undefined): string | null {
  if (!baseYmd) return null
  const off = Number(String(offsetRaw ?? '0').trim())
  if (!Number.isFinite(off) || off === 0) return baseYmd
  return addDaysUtcYmd(baseYmd, off)
}

/** getPkgProdInfo.pkgAirSeqList — 편명·항공사·공항·일시 SSOT (REGRESSION-FREEZE[register-detail-collect-flight-apply]) */
export function buildHanatourFlightStructuredFromProdInfo(
  info: HanatourProdInfoExtended | null | undefined,
): FlightStructured | null {
  if (!info) return null
  const baseYmd = hanatourYmdFromDepDay(info.depDay)
  const rows = info.pkgAirSeqList ?? []
  const outboundRow = rows.find((r) => String(r.segSeq) === '1') ?? rows[0]
  const inboundRow = rows.find((r) => String(r.segSeq) === '2') ?? rows[rows.length - 1]
  const airlCd = outboundRow?.airlCd ?? inboundRow?.airlCd ?? info.depAirCd ?? null

  const outbound = outboundRow
    ? {
        departureAirport: outboundRow.depAptNm?.trim() || outboundRow.depAptCityNm?.trim() || null,
        departureAirportCode: outboundRow.depAptCd?.trim() || null,
        departureDate: hanatourLegDate(baseYmd, outboundRow.depBassFlxbDt),
        departureTime: hanatourHmToDisplay(outboundRow.depHm),
        arrivalAirport: outboundRow.arrAptNm?.trim() || outboundRow.arrAptCityNm?.trim() || null,
        arrivalAirportCode: outboundRow.arrAptCd?.trim() || null,
        arrivalDate: hanatourLegDate(baseYmd, outboundRow.arrBassFlxbDt),
        arrivalTime: hanatourHmToDisplay(outboundRow.arrHm),
        flightNo: hanatourFlightNo(outboundRow.airlCd, outboundRow.flgtNm),
        durationText: null,
      }
    : {
        departureAirport:
          hanatourDepartureAirportLabelFromCodes(info.depAirCd, info.depCityCd) ||
          info.depCityNm?.trim() ||
          null,
        departureAirportCode: info.depAirCd?.trim() || null,
        departureDate: baseYmd,
        departureTime: hanatourHmToDisplay(info.depTm),
        arrivalAirport: info.arrCityNm?.trim() || null,
        arrivalAirportCode: null,
        arrivalDate: hanatourYmdFromDepDay(info.arrDay),
        arrivalTime: hanatourHmToDisplay(info.arrTm),
        flightNo: hanatourFlightNo(airlCd, info.depFlgtCd),
        durationText: null,
      }

  const inbound = inboundRow
    ? {
        departureAirport: inboundRow.depAptNm?.trim() || inboundRow.depAptCityNm?.trim() || null,
        departureAirportCode: inboundRow.depAptCd?.trim() || null,
        departureDate: hanatourLegDate(baseYmd, inboundRow.depBassFlxbDt),
        departureTime: hanatourHmToDisplay(inboundRow.depHm),
        arrivalAirport: inboundRow.arrAptNm?.trim() || inboundRow.arrAptCityNm?.trim() || null,
        arrivalAirportCode: inboundRow.arrAptCd?.trim() || null,
        arrivalDate: hanatourLegDate(baseYmd, inboundRow.arrBassFlxbDt),
        arrivalTime: hanatourHmToDisplay(inboundRow.arrHm),
        flightNo: hanatourFlightNo(inboundRow.airlCd, inboundRow.flgtNm),
        durationText: null,
      }
    : {
        departureAirport: info.arrCityNm?.trim() || null,
        departureAirportCode: null,
        departureDate: hanatourYmdFromDepDay(info.arrDay),
        departureTime: hanatourHmToDisplay(info.arrTm),
        arrivalAirport:
          hanatourDepartureAirportLabelFromCodes(info.depAirCd, info.depCityCd) || '인천국제공항',
        arrivalAirportCode: info.depAirCd?.trim() || null,
        arrivalDate: hanatourYmdFromDepDay(info.arrDay),
        arrivalTime: hanatourHmToDisplay(info.arrTm),
        flightNo: hanatourFlightNo(airlCd, info.arrFlgtCd),
        durationText: null,
      }

  const airlineName =
    outboundRow?.airlNm?.trim() ||
    inboundRow?.airlNm?.trim() ||
    String(info.airlNm ?? '').trim() ||
    null
  const hasOb = Boolean(outbound.flightNo || outbound.departureTime)
  const hasIb = Boolean(inbound.flightNo || inbound.departureTime)
  if (!hasOb && !hasIb) return null

  return {
    airlineName,
    outbound,
    inbound,
    rawFlightLines: [],
    debug: {
      candidateCount: rows.length || 1,
      selectedOutRaw: outbound.flightNo,
      selectedInRaw: inbound.flightNo,
      partialStructured: !(hasOb && hasIb && airlineName),
      status: hasOb && hasIb && airlineName ? 'success' : 'partial',
      exposurePolicy: 'public_full',
      supplierBrandKey: 'hanatour',
      expectFlightNumber: true,
    },
    reviewNeeded: false,
    reviewReasons: [],
  }
}

export async function fetchHanatourPkgProdItnr(pkgCd: string): Promise<HanatourItnrResponse | null> {
  return postHanatourGw<HanatourItnrResponse>('/package/pkg/api/common/pkgcomprod/getPkgProdItnrInfo/v1.00', {
    pkgCd,
  })
}

export async function fetchHanatourRegisterDetailBundle(originUrl: string): Promise<{
  pkgCd: string
  prodInfo: HanatourProdInfoExtended | null
  itnr: HanatourItnrResponse | null
  chcStsng: HanatourChcStsngResponse | null
} | null> {
  const pkgCd = parseHanatourPkgCdFromUrl(originUrl)
  if (!pkgCd) return null
  const [prodInfo, itnr, chcStsng] = await Promise.all([
    fetchHanatourPkgProdInfo(pkgCd) as Promise<HanatourProdInfoExtended | null>,
    fetchHanatourPkgProdItnr(pkgCd),
    fetchHanatourPkgProdChcStsngInfo(pkgCd),
  ])
  return { pkgCd, prodInfo, itnr, chcStsng }
}
