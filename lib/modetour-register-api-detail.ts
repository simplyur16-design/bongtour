/**
 * 모두투어 등록 상세카드 — GetProductDetailInfo·GetPackageInfo·GetProductKeyPointInfo B2C API.
 *
 * REGRESSION-FREEZE[modetour-register-detail-collect]: includedNote·unincludedNote·specialBenefits — manifest
 * REGRESSION-FREEZE[modetour-register-danang-live-gate]: GetOptionalTourList·GetShoppingList — manifest
 */
import { decodeBasicHtmlEntities } from '@/lib/departure-option-modetour'
import { fetchModetourGroupDetailInfo, parseModetourPackageProductNoFromUrl } from '@/lib/modetour-departures'
import { normalizeModetourOptionalTourDisplayName } from '@/lib/modetour-optional-tour-name'
import { sanitizeIncludedExcludedItemsLines } from '@/lib/included-excluded-postprocess'
import {
  buildModetourFlightStructuredFromRoutes,
  type ModetourFlightRouteItem,
} from '@/lib/register-facts/modetour-register-fact-mappers'

export { buildModetourFlightStructuredFromRoutes }

const MODETOUR_API_BASE = process.env.MODETOUR_API_BASE_URL ?? 'https://b2c-api.modetour.com'
const MODETOUR_WEB_API_REQ_HEADER =
  process.env.MODETOUR_WEB_API_REQ_HEADER ??
  '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}'

export type ModetourOptionalTourApiRow = {
  name?: string | null
  currency?: string | null
  priceAdult?: number | null
  priceChild?: number | null
  durationTime?: string | null
  readyPlace?: string | null
  isWithGuide?: boolean | null
  minUserCount?: number | null
}

export type ModetourShoppingApiRow = {
  itemName?: string | null
  contentsPlaceInfos?: string[] | null
  durationTime?: string | null
  isRefundEnabled?: boolean | null
}

export type ModetourRegisterDetailBundle = {
  detailInfo: Record<string, unknown> | null
  packageInfo: Record<string, unknown> | null
  keyPointInfo: Record<string, unknown> | null
  optionalTourList: ModetourOptionalTourApiRow[]
  shoppingList: ModetourShoppingApiRow[]
  flightRoutes: ModetourFlightRouteItem[]
}

function modetourB2cHeaders(referer: string, productNo: string): HeadersInit {
  return {
    accept: 'application/json, text/plain, */*',
    'accept-language': 'ko-KR',
    referer,
    'x-platform': 'ModeEcommerce',
    'x-salespartner': '2',
    'x-userdepartment': 'ModeEcommerce',
    'x-incomming-pathname': `/package/${productNo}`,
    modewebapireqheader: MODETOUR_WEB_API_REQ_HEADER,
  }
}

async function fetchModetourJson<T>(url: string, headers: HeadersInit): Promise<T | null> {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export function modetourHtmlNoteToPlainText(html: string | null | undefined): string | null {
  const raw = String(html ?? '').trim()
  if (!raw) return null
  const text = decodeBasicHtmlEntities(raw)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
  const lines = text
    .split('\n')
    .map((l) => l.replace(/^[\s\-•·▪–—▶]+/, '').replace(/^\d+[.)]\s*/, '').trim())
    .filter((l) => l.length > 1 && !isModetourIncludedExcludedJunkLine(l))
  return lines.length > 0 ? lines.join('\n') : null
}

function isModetourIncludedExcludedJunkLine(line: string): boolean {
  const t = line.replace(/\s+/g, ' ').trim()
  if (!t || /^untitled$/i.test(t)) return true
  if (/telerik-style|font-family|margin-top|margin-bottom|border-collapse|line-height\s*:/i.test(t)) return true
  if (/^\.(?:Normal|TableNormal|NormalWeb|s_[A-F0-9]+)\b/i.test(t)) return true
  if (/^body\s*\{|^p\s*\{/i.test(t)) return true
  return false
}

export function modetourPlainTextToBullets(raw: string | null | undefined): string[] {
  const t = (raw ?? '').trim()
  if (!t) return []
  const normalized = t.replace(/\r/g, '').replace(/▶/g, '\n▶ ')
  return sanitizeIncludedExcludedItemsLines(
    normalized
      .split(/\n/)
      .flatMap((line) => {
        const trimmed = line.trim()
        if (!trimmed) return []
        const numbered = trimmed
          .split(/(?=\d+[.)]\s)/)
          .map((p) => p.replace(/^\d+[.)]\s*/, '').trim())
          .filter(Boolean)
        const parts = numbered.length > 1 ? numbered : [trimmed.replace(/^[\s\-•·▪–—▶]+/, '').trim()]
        return parts.filter((p) => p.length > 1 && !isModetourIncludedExcludedJunkLine(p))
      })
      .filter((l) => l.length > 1 && l.length < 400),
  )
}

export function extractModetourIncludedExcludedFromDetailInfo(detail: Record<string, unknown> | null | undefined): {
  includedText: string | null
  excludedText: string | null
  includedItems: string[]
  excludedItems: string[]
} {
  const includedText = modetourHtmlNoteToPlainText(String(detail?.includedNote ?? ''))
  const excludedText = modetourHtmlNoteToPlainText(String(detail?.unincludedNote ?? ''))
  return {
    includedText,
    excludedText,
    includedItems: modetourPlainTextToBullets(includedText),
    excludedItems: modetourPlainTextToBullets(excludedText),
  }
}

export function extractModetourShoppingFromDetailBundle(
  detail: Record<string, unknown> | null | undefined,
  packageInfo: Record<string, unknown> | null | undefined,
): { shoppingVisitCount: number | null; noShoppingFlag: boolean | null } {
  const shoppingTimes = Number(detail?.shoppingTimes)
  const shoppingCount = Number(packageInfo?.shoppingCount)
  let shoppingVisitCount: number | null = null
  if (Number.isFinite(shoppingTimes) && shoppingTimes >= 0) shoppingVisitCount = shoppingTimes
  else if (Number.isFinite(shoppingCount) && shoppingCount >= 0) shoppingVisitCount = shoppingCount

  const noteHay = `${String(detail?.shoppingNote ?? '')} ${String(detail?.notesWhenShopping ?? '')}`
  const noShoppingFlag = /노쇼핑|쇼핑\s*없음/i.test(noteHay)
    ? true
    : shoppingVisitCount === 0
      ? true
      : shoppingVisitCount != null && shoppingVisitCount > 0
        ? false
        : null

  return { shoppingVisitCount, noShoppingFlag }
}

export function extractModetourMustKnowFromKeyPointInfo(
  keyPoint: Record<string, unknown> | null | undefined,
): Array<{ category: '안전/유의' | '현지준비' | '입국/비자'; title: string; body: string; raw: string }> {
  if (!keyPoint) return []
  const items: Array<{ category: '안전/유의' | '현지준비' | '입국/비자'; title: string; body: string; raw: string }> = []
  const push = (category: '안전/유의' | '현지준비' | '입국/비자', title: string, body: string) => {
    const b = body.trim()
    if (!b || b === '상품 핵심 포인트') return
    items.push({ category, title, body: b, raw: b })
  }

  const asRows = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

  for (const row of asRows(keyPoint.specialBenefits)) {
    const b = String(row ?? '').trim()
    if (b) push('현지준비', '특별 혜택', b)
  }
  for (const row of asRows(keyPoint.sightseeings)) {
    const b = String(row ?? '').trim()
    if (b) push('현지준비', '관광 포인트', b)
  }
  for (const row of asRows(keyPoint.hotels)) {
    const b = String(row ?? '').trim()
    if (b) push('현지준비', '숙소', b)
  }
  for (const row of asRows(keyPoint.meals)) {
    const b = String(row ?? '').trim()
    if (b) push('현지준비', '식사', b)
  }

  const leader = String(keyPoint.leaderGuild ?? '').trim()
  const leaderStatus = String(keyPoint.leaderStatus ?? '').trim()
  if (leader && !/정보\s*확인/.test(leader)) {
    push('현지준비', '인솔자/가이드', [leader, leaderStatus].filter(Boolean).join(' · '))
  } else if (leaderStatus && leaderStatus !== '미정') {
    push('현지준비', '인솔자/가이드', leaderStatus)
  }

  const insurance = String(keyPoint.travelerInsuranceInfo ?? '').trim()
  if (insurance) push('안전/유의', '여행자 보험', insurance)
  const guarantee = String(keyPoint.businessGuarantee ?? '').trim()
  if (guarantee) push('안전/유의', '공제/보증', guarantee)
  const mile = String(keyPoint.tourMile ?? '').trim()
  if (mile) push('현지준비', '투어 마일리지', mile)

  return items
}

function normalizeModetourApiCurrency(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim().toUpperCase()
  if (!s || s === '$') return 'USD'
  if (s === '원' || s === '￦') return 'KRW'
  if (/^[A-Z]{3}$/.test(s)) return s
  return s.slice(0, 3) || 'USD'
}

/** GetOptionalTourList → 등록 optionalToursStructured 행 */
export function extractModetourOptionalToursFromApiList(
  rows: readonly ModetourOptionalTourApiRow[],
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = []
  for (const row of rows) {
    const rawName = String(row.name ?? '').trim()
    if (!rawName) continue
    const tourName = normalizeModetourOptionalTourDisplayName(rawName)
    const currency = normalizeModetourApiCurrency(row.currency)
    const adult = Number(row.priceAdult)
    const child = Number(row.priceChild)
    const durationText = String(row.durationTime ?? '').trim() || null
    const minPeopleText =
      row.minUserCount != null && Number.isFinite(Number(row.minUserCount))
        ? `${Number(row.minUserCount)}명`
        : null
    const guide同行Text =
      row.isWithGuide === true ? '동행' : row.isWithGuide === false ? '동행안함' : null
    const waitingPlaceText = String(row.readyPlace ?? '').trim() || null
    const childPart = Number.isFinite(child) ? ` / 아동 ${currency} ${child}` : ''
    const priceText = Number.isFinite(adult) ? `성인 ${currency} ${adult}${childPart}` : ''
    out.push({
      name: tourName,
      tourName,
      currency,
      adultPrice: Number.isFinite(adult) ? adult : null,
      childPrice: Number.isFinite(child) ? child : null,
      durationText,
      minPeopleText,
      guide同行Text,
      waitingPlaceText,
      alternateScheduleText: waitingPlaceText ?? undefined,
      descriptionText: '',
      priceText,
      raw: rawName,
    })
  }
  return out
}

/** GetShoppingList → 등록 shoppingStops JSON 행(모두투어 후보 그룹 형식) */
export function extractModetourShoppingStopsFromApiList(
  rows: readonly ModetourShoppingApiRow[],
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = []
  rows.forEach((row, idx) => {
    const item = String(row.itemName ?? '').trim()
    if (!item) return
    const places = (row.contentsPlaceInfos ?? [])
      .map((p) => String(p).trim())
      .filter((p) => p.length > 0)
    const shop = places[0] ?? item
    const durationText = String(row.durationTime ?? '').trim() || null
    const refundPolicyText =
      row.isRefundEnabled === true ? '환불가능' : row.isRefundEnabled === false ? '환불불가' : null
    out.push({
      shoppingItem: item,
      itemType: item,
      shoppingPlace: shop,
      placeName: shop,
      shopName: shop,
      durationText,
      refundPolicyText,
      noteText: places.length > 1 ? places.join(', ') : undefined,
      candidateOnly: places.length > 1 ? true : undefined,
      candidateGroupKey: places.length > 1 ? `modetour:api:g${idx}` : undefined,
      raw: item,
    })
  })
  return out
}

export async function fetchModetourRegisterDetailBundle(
  originUrl: string,
  opts?: { includeOptShop?: boolean; includeFlight?: boolean },
): Promise<ModetourRegisterDetailBundle | null> {
  const productNo = parseModetourPackageProductNoFromUrl(originUrl)
  if (!productNo || productNo === '0') return null

  const referer = originUrl.trim() || `https://www.modetour.com/package/${productNo}`
  const headers = modetourB2cHeaders(referer, productNo)
  const base = MODETOUR_API_BASE.replace(/\/$/, '')

  const includeOptShop = opts?.includeOptShop === true
  const includeFlight = opts?.includeFlight === true
  const [detailInfo, packageJson, keyPointJson, optionalJson, shoppingJson, flightJson] = await Promise.all([
    fetchModetourGroupDetailInfo(originUrl),
    fetchModetourJson<{ result?: Record<string, unknown> }>(
      `${base}/Package/GetPackageInfo?productNo=${encodeURIComponent(productNo)}`,
      headers,
    ),
    fetchModetourJson<{ result?: Record<string, unknown> }>(
      `${base}/Package/GetProductKeyPointInfo?productNo=${encodeURIComponent(productNo)}`,
      headers,
    ),
    includeOptShop
      ? fetchModetourJson<{ result?: ModetourOptionalTourApiRow[] }>(
          `${base}/Package/GetOptionalTourList?productNo=${encodeURIComponent(productNo)}`,
          headers,
        )
      : Promise.resolve(null),
    includeOptShop
      ? fetchModetourJson<{ result?: ModetourShoppingApiRow[] }>(
          `${base}/Package/GetShoppingList?productNo=${encodeURIComponent(productNo)}`,
          headers,
        )
      : Promise.resolve(null),
    includeFlight
      ? fetchModetourJson<{ result?: ModetourFlightRouteItem[] }>(
          `${base}/Package/ItineraryDlgFlightRoute?productNo=${encodeURIComponent(productNo)}`,
          headers,
        )
      : Promise.resolve(null),
  ])

  return {
    detailInfo,
    packageInfo: packageJson?.result ?? null,
    keyPointInfo: keyPointJson?.result ?? null,
    optionalTourList: Array.isArray(optionalJson?.result) ? optionalJson.result : [],
    shoppingList: Array.isArray(shoppingJson?.result) ? shoppingJson.result : [],
    flightRoutes: Array.isArray(flightJson?.result) ? flightJson.result : [],
  }
}
