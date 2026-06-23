/**
 * 하나투어 등록 상세카드 — gw API 응답 파싱 SSOT.
 *
 * REGRESSION-FREEZE[hanatour-register-detail-collect]: getPkgProdInfo·getPkgProdItnrInfo·getPkgProdChcStsngInfo 매핑 — manifest
 */
import {
  fetchHanatourPkgProdInfo,
  parseHanatourPkgCdFromUrl,
  type HanatourPkgProdInfo,
} from '@/lib/hanatour-api-departures'
import type { RegisterFactScheduleDay } from '@/lib/register-facts/types'
import type { OptionalTourRowFields } from '@/lib/optional-tour-row-gate-hanatour'
import type { ShoppingStructured } from '@/lib/detail-body-parser-types'
import type { RegisterScheduleDay } from '@/lib/register-llm-schema-hanatour'
import { stripMealTypeLabelPrefix } from '@/lib/register-schedule-meal-parse'
import { shoppingStructuredRowToPersistStop } from '@/lib/shopping-structured-row-to-persist'

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

export type HanatourItnrSchdMain = {
  schdCatgNm?: string | null
  schdCont?: string | null
  schdTitlNm?: string | null
  cardNm?: string | null
  cardCntntPc?: string | null
  cardCntntMbl?: string | null
  schdRqrmHm?: string | null
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

export type HanatourProdInfoExtended = HanatourPkgProdInfo & {
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
  rppdCntntInfoList?: HanatourCorePointRow[]
  agtRmkCont?: string | null
  noptYn?: string | null
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
  return days.map((d) => {
    const title = (d.places[0] ?? d.hotels[0] ?? '').trim() || `${d.day}일차`
    const description = [...d.places, d.transportNote].filter(Boolean).join('\n') || title
    const routeText = d.places.length > 0 ? d.places.join(' - ') : null
    const hotelText = d.hotels.length > 0 ? d.hotels.join(' / ') : null
    const breakfast = d.meals.find((m) => /조식|아침/.test(m)) ?? null
    const lunch = d.meals.find((m) => /중식|점심/.test(m)) ?? null
    const dinner = d.meals.find((m) => /석식|저녁/.test(m)) ?? null
    return {
      day: d.day,
      title,
      description,
      routeText,
      imageKeyword: (d.places[0] ?? title).slice(0, 80),
      hotelText,
      breakfastText: stripMealTypeLabelPrefix(breakfast),
      lunchText: stripMealTypeLabelPrefix(lunch),
      dinnerText: stripMealTypeLabelPrefix(dinner),
      mealSummaryText: d.meals.length > 0 ? d.meals.join(' / ') : null,
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
  for (const row of info.rppdCntntInfoList ?? []) {
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
      const title = stripHanatourHtmlText(String(main.schdTitlNm ?? main.schdCont ?? '')).slice(0, 200)
      if (!title) continue
      if (cat.includes('관광')) fact.places.push(title)
      else if (cat.includes('숙박') || cat.includes('호텔')) fact.hotels.push(title)
      else if (cat.includes('식사')) fact.meals.push(title)
      else if (cat.includes('이동') || cat.includes('항공')) {
        fact.transportNote = fact.transportNote ? `${fact.transportNote}; ${title}` : title
      } else {
        fact.places.push(title)
      }
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
