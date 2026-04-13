/**
 * 모두투어: 관리자 **복붙 본문 + Gemini** 가 상품 설명·가격·출발 표의 SSOT (`POST /api/travel/parse-and-register-modetour` 등록 파이프).
 * 아래 API/HTML 수집(`collectModetourDepartureInputs` 등)은 **관리자 출발 재수집** 및 **등록 확정(confirm)** 시
 * 선수집(ProductDeparture·기준 제목)에 사용된다(상세 HTML fetch·다수 pId 조회로 느려질 수 있음).
 * pId별 GetProductDetailInfo 는 **고유 pId를 모아 청크 병렬 프리패치** 후 캐시에서 읽는다(구버전: 행마다 순차 요청).
 */
import type { DepartureInput } from '@/lib/upsert-product-departures-modetour'
import {
  buildCommonMatchingTrace,
  buildDepartureTitleLayers,
  decodeBasicHtmlEntities,
  type DepartureTitleLayers,
} from '@/lib/departure-option-modetour'
import { extractPricePromotionFromHtml, type PricePromotionSnapshot } from '@/lib/price-promotion-modetour'
import {
  departureInputToYmd,
  filterDepartureInputsOnOrAfterCalendarToday,
  scrapeCalendarTodayYmd,
  SCRAPE_DEFAULT_MONTHS_FORWARD,
} from '@/lib/scrape-date-bounds'
import {
  applyDepartureTerminalMeetingInfo,
  buildDepartureTerminalInfo,
  inferDepartureAirportCodeFromKoreanDetailText,
} from '@/lib/meeting-terminal-rules'

type ModetourDepartureRow = Record<string, unknown> & {
  pId?: number
  minPrice?: number
  departureDate?: string
}

type ModetourDepartureResponse = {
  result?: ModetourDepartureRow[]
  errorMessages?: string[] | null
  isOK?: boolean
}

type ModetourPackageInfoResponse = {
  result?: {
    booking?: {
      restSeat?: number | string | null
      minSeat?: number | string | null
    } | null
  } | null
}

type ModetourDetailInfoResponse = {
  result?: Record<string, unknown> & {
    departureDate?: string | null
    reserveStatusKorean?: string | null
    reserveStatus?: string | null
    availableSeatNumber?: number | string | null
    minimumDepartureNumberOfPeople?: number | string | null
    bookingSeatNumber?: number | string | null
    airLineName?: string | null
    airlineName?: string | null
    carrierName?: string | null
    departureTime?: string | null
    arrivalTime?: string | null
  } | null
}

const MODETOUR_API_BASE = process.env.MODETOUR_API_BASE_URL ?? 'https://b2c-api.modetour.com'
const MODETOUR_WEB_API_REQ_HEADER =
  process.env.MODETOUR_WEB_API_REQ_HEADER ??
  '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}'

export type ModetourCollectMeta = {
  filledFields: string[]
  missingFields: string[]
  mappingStatus: 'per-date-confirmed' | 'price-only-confirmed' | 'detail-candidate-found-but-unmapped'
  notes: string[]
}

/** Product 코어 — DB Product 적재 시 매핑용 (출발일별 가격 없음) */
export type ModetourProductCore = {
  originSource: string
  originCode: string | null
  originUrl: string
  supplierGroupId: string | null
  supplierProductCode: string | null
  rawTitle: string
  preHashTitle: string
  comparisonTitle: string
  comparisonTitleNoSpace: string
  title: string
  primaryDestination: string | null
  destinationRaw: string | null
  imageUrl: string | null
  productType: string | null
  summary: string | null
  benefitSummary: string | null
  airline: string | null
  duration: string | null
  tripNights: number | null
  tripDays: number | null
  shoppingVisitCountTotal: number | null
  meetingInfoRaw: string | null
  guideTypeRaw: string | null
  tourLeaderTypeRaw: string | null
  mandatoryLocalFee: number | null
  mandatoryCurrency: string | null
  includedText: string | null
  excludedText: string | null
  criticalExclusions: string | null
  optionalTourSummaryRaw: string | null
  hasOptionalTours: boolean | null
  cardBenefitSummaryShort: string | null
  registrationStatus: string | null
  themeLabelsRaw: string | null
  promotionLabelsRaw: string | null
  insuranceSummaryRaw: string | null
  hotelSummaryRaw: string | null
  foodSummaryRaw: string | null
  reservationNoticeRaw: string | null
  rawMeta: string | null
  noShoppingFlag: boolean | null
  noOptionFlag: boolean | null
  freeDayIncludedFlag: boolean | null
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** document.title / 잘못된 h1 에 붙는 패키지>상품상세>코드> 접두 제거 */
function cleanModetourBaselineTitleSource(raw: string, productNo: string | null | undefined): string {
  let t = decodeBasicHtmlEntities(String(raw ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t) return ''
  const pcode = (productNo ?? '').trim()
  const pcodeUpper = pcode ? pcode.toUpperCase() : ''

  const fb = t.indexOf('[')
  if (fb > 0) {
    const prefix = t.slice(0, fb)
    if (
      /[>›|]/.test(prefix) ||
      /상품\s*상세/i.test(prefix) ||
      /패키지/i.test(prefix) ||
      (pcodeUpper && prefix.toUpperCase().includes(pcodeUpper))
    ) {
      return t.slice(fb).trim()
    }
  }

  let guard = 0
  while (guard++ < 14) {
    const before = t
    t = t.replace(/^패키지\s*[>›|]\s*/i, '').trim()
    t = t.replace(/^상품\s*상세\s*[>›|]\s*/i, '').trim()
    if (pcodeUpper && t.length >= pcode.length && t.slice(0, pcode.length).toUpperCase() === pcodeUpper) {
      t = t.slice(pcode.length).replace(/^[>\s›|]+/, '').trim()
    }
    t = t.replace(/^[A-Z]{2,5}\d{3,12}[A-Z0-9]{0,10}\s*[>›|]+\s*/i, '').trim()
    if (t === before) break
  }
  return t.trim()
}

type ModetourBaselineTitlePick =
  | 'h1.product_tit'
  | 'h1'
  | 'meta.title'
  | 'jsonld.product_name'
  | 'document.title'
  | 'og:title'
  | 'twitter:title'
  | 'none'

export type ModetourBaselineTrace = {
  pickedSource: ModetourBaselineTitlePick
  raw: string
  cleaned: string
}

type ModetourBaselineExtraction = {
  layers: DepartureTitleLayers
  trace: ModetourBaselineTrace | null
}

const MODETOUR_KNOWN_CARRIERS =
  '대한항공|아시아나항공|제주항공|진에어|티웨이항공|에어부산|에어서울|이스타항공|에어프레미아|플라이강원|에어로케이|하이에어'

function extractModetourBaselineCarrier(detailHtml: string | null, detailText: string): string | null {
  const block =
    detailHtml?.match(/(?:여행\s*핵심\s*정보|항공\s*여정)[\s\S]{0,3500}/i)?.[0] ??
    detailHtml?.slice(0, 20000) ??
    ''
  const t = `${stripTags(block)}\n${detailText.slice(0, 12000)}`
  const known = t.match(new RegExp(`(${MODETOUR_KNOWN_CARRIERS})`))
  if (known?.[1]) return known[1]!
  const loose = t.match(/([\uAC00-\uD7A3]{2,12}항공)/)
  if (loose?.[1] && !/미정|예정|항공사|이용\s*항공/.test(loose[1])) return loose[1]!
  return null
}

function parseTripNightsDays(text: string | null | undefined): { tripNights: number | null; tripDays: number | null } {
  const s = String(text ?? '')
  const patterns = [/(\d+)\s*박\s*(\d+)\s*일/u, /(\d+)박\s*(\d+)일/u, /(\d+)\s*박\s*(\d+)\s*일차/u]
  for (const re of patterns) {
    const m = s.match(re)
    if (m) {
      const n = Number(m[1])
      const d = Number(m[2])
      if (Number.isFinite(n) && Number.isFinite(d) && n >= 0 && d > 0) return { tripNights: n, tripDays: d }
    }
  }
  return { tripNights: null, tripDays: null }
}

function parseTripNightsDaysFromModetourPage(detailText: string, detailHtml: string | null): {
  tripNights: number | null
  tripDays: number | null
} {
  const focus =
    [
      detailHtml?.match(/여행\s*핵심\s*정보[\s\S]{0,4000}/i)?.[0],
      detailHtml?.match(/항공\s*여정[\s\S]{0,4000}/i)?.[0],
      detailHtml?.match(/상품\s*개요[\s\S]{0,4000}/i)?.[0],
    ]
      .filter(Boolean)
      .join('\n') || ''
  const hay = `${stripTags(focus)}\n${detailText}`
  const p = parseTripNightsDays(hay)
  if (p.tripNights != null && p.tripDays != null) return p
  return parseTripNightsDays(detailText)
}

/** 공백만 정리. 괄호·해시·본문은 동일상품 제목 비교 축으로 유지(buildDepartureTitleLayers가 선행 `[배지]`만 제거). */
export function modetourRefineTitleLayers(base: DepartureTitleLayers): DepartureTitleLayers {
  const comparisonTitle = base.comparisonTitle.replace(/\s+/g, ' ').trim()
  const comparisonTitleNoSpace = comparisonTitle.replace(/\s+/g, '')
  return {
    ...base,
    comparisonTitle,
    comparisonTitleNoSpace,
  }
}

function parseProductNo(originUrl: string | null | undefined): string | null {
  if (!originUrl) return null
  try {
    const u = new URL(originUrl)
    const pnum = u.searchParams.get('pnum')?.trim()
    if (pnum && /^\d+$/.test(pnum)) return pnum
    const m = u.pathname.match(/\/package\/(\d+)/i)
    if (m?.[1]) return m[1]
    return null
  } catch {
    const m = String(originUrl).match(/\/package\/(\d+)/i)
    return m?.[1] ?? null
  }
}

export function parseModetourPackageProductNoFromUrl(originUrl: string | null | undefined): string | null {
  return parseProductNo(originUrl)
}

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addMonths(d: Date, months: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate()))
}

function toNum(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function parseLocalPid(localPriceText: string | null | undefined): string | null {
  if (!localPriceText) return null
  const m = String(localPriceText).match(/modetour:pId=(\d+)/)
  return m?.[1] ?? null
}

/**
 * GetOtherDepartureDates 등 JSON 행에 붙는 통화칸(키 이름이 버전마다 다를 수 있음).
 * UI의 통화 표기와 동일한 값이 오면 adultPrice(minPrice)와 함께 해석할 때 사용.
 */
function normalizeModetourCurrencyToken(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  if (/^원$|^₩$|￦/u.test(t) || /^krw$/i.test(t) || /^won$/i.test(t)) return 'KRW'
  const u = t.toUpperCase().replace(/\s+/g, '')
  if (/^[A-Z]{3}$/.test(u)) return u
  return null
}

function modetourRowCurrencyCode(r: Record<string, unknown>): string | null {
  const directKeys = [
    'currencyCode',
    'CurrencyCode',
    'currency',
    'Currency',
    'priceCurrency',
    'PriceCurrency',
    'minPriceCurrency',
    'MinPriceCurrency',
    'moneyUnit',
    'MoneyUnit',
    'displayCurrency',
    'DisplayCurrency',
    'saleCurrency',
    'SaleCurrency',
  ]
  for (const k of directKeys) {
    if (!(k in r)) continue
    const v = r[k]
    if (v == null) continue
    const norm = normalizeModetourCurrencyToken(String(v))
    if (norm) return norm
  }
  for (const [k, v] of Object.entries(r)) {
    if (!/[Cc]urrency|[Mm]oney|[Uu]nit|통화|ccy/i.test(k)) continue
    if (v == null) continue
    const norm = normalizeModetourCurrencyToken(String(v))
    if (norm) return norm
  }
  return null
}

function buildModetourLocalPriceText(pid: string, row: Record<string, unknown>): string {
  const parts = [`modetour:pId=${pid}`]
  const ccy = modetourRowCurrencyCode(row)
  if (ccy) parts.push(`ccy=${ccy}`)
  return parts.join('|').slice(0, 200)
}

function toHeader(referer: string, productNo: string): HeadersInit {
  return {
    accept: 'application/json, text/plain, */*',
    'accept-language': 'ko-KR',
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
    referer,
    'x-platform': 'ModeEcommerce',
    'x-salespartner': '2',
    'x-userdepartment': 'ModeEcommerce',
    'x-incomming-pathname': `/package/${productNo}`,
    modewebapireqheader: MODETOUR_WEB_API_REQ_HEADER,
  }
}

async function fetchJson<T>(url: string, headers: HeadersInit): Promise<T> {
  const res = await fetch(url, { method: 'GET', headers })
  if (!res.ok) throw new Error(`modetour api failed: HTTP ${res.status} (${url})`)
  return (await res.json()) as T
}

/** 동시에 너무 많은 요청을 보내지 않도록 청크 단위 병렬 프리패치 */
const MODETOUR_PID_PREFETCH_CHUNK = 12

async function prefetchPidDetailsInChunks(
  pids: string[],
  fetchOne: (pid: string) => Promise<unknown>
): Promise<void> {
  const unique = [...new Set(pids.map((p) => String(p).trim()).filter(Boolean))]
  for (let i = 0; i < unique.length; i += MODETOUR_PID_PREFETCH_CHUNK) {
    const chunk = unique.slice(i, i + MODETOUR_PID_PREFETCH_CHUNK)
    await Promise.all(chunk.map((pid) => fetchOne(pid)))
  }
}

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'

async function fetchDetailHtml(originUrl: string, productNo: string): Promise<string | null> {
  try {
    const u = originUrl?.trim() || `https://www.modetour.com/package/${productNo}`
    const res = await fetch(u, {
      method: 'GET',
      headers: {
        'user-agent': BROWSER_UA,
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'ko-KR',
      },
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

function normalizeBaselineRaw(raw: string): string {
  return decodeBasicHtmlEntities(String(raw ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 날짜+상품코드·코드만·브레드크럼 등 — baseline 소스로 부적절 */
function isModetourWeakBaselineTitleText(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t) return true
  if (t.length < 4) return true
  if (/패키지\s*[>›|]|상품\s*상세/i.test(t)) return true
  if (/^[A-Z]{2,5}\d{3,12}[A-Z0-9]{0,10}\s*[>›|]/i.test(t)) return true
  if (/^\d{4}-\d{2}-\d{2}\s+[A-Za-z0-9][A-Za-z0-9\-]{4,}$/.test(t)) return true
  if (/^\d{4}[./-]\d{2}[./-]\d{2}\s+[A-Za-z0-9][A-Za-z0-9\-]{4,}$/.test(t)) return true
  if (/^[A-Z]{2,5}\d{3,12}[A-Z0-9]*$/i.test(t) && t.length <= 24) return true
  if (!/[\uAC00-\uD7A3]/.test(t) && /^\d{4}-\d{2}-\d{2}$/.test(t.split(/\s+/)[0] ?? '')) return true
  if (!/[\uAC00-\uD7A3]/.test(t) && /^[\d\s.\-/]+\s+[A-Z0-9\-]{6,}$/i.test(t)) return true
  return false
}

function modetourBaselineTitleHasProductSignals(cleaned: string): boolean {
  const t = cleaned.trim()
  if (t.length < 6) return false
  if (/[\uAC00-\uD7A3]/.test(t)) return true
  if (/\d+\s*박\s*\d+\s*일|\d+\s*일차/i.test(t)) return true
  if (/\b(TOKYO|OSAKA|PARIS|SEOUL|BANGKOK|HANOI|DANANG|FUKUOKA|SAPPORO|HONG\s*KONG)\b/i.test(t)) return true
  if (t.length >= 14 && /[a-zA-Z가-힣]/.test(t)) return true
  return false
}

function isModetourDocumentTitleLikelyContaminated(raw: string): boolean {
  const t = raw.trim()
  if ((t.match(/[>›|]/g) ?? []).length >= 3) return true
  if (/모두투어|modetour/i.test(t) && /[>›|]/.test(t) && !/[\uAC00-\uD7A3]{4,}/.test(t)) return true
  return false
}

function walkJsonLdForProductName(node: unknown, depth: number): string | null {
  if (depth > 14) return null
  if (node == null) return null
  if (Array.isArray(node)) {
    for (const x of node) {
      const n = walkJsonLdForProductName(x, depth + 1)
      if (n) return n
    }
    return null
  }
  if (typeof node !== 'object') return null
  const o = node as Record<string, unknown>
  if (o['@graph']) {
    const n = walkJsonLdForProductName(o['@graph'], depth + 1)
    if (n) return n
  }
  const typ = String(o['@type'] ?? '')
  const types = typ.includes(',') ? typ.split(',') : [typ]
  for (const one of types) {
    const tl = one.trim().toLowerCase()
    if (/product|touristtrip|trip|travel/.test(tl)) {
      const name = String(o.name ?? '').trim()
      if (name) return normalizeBaselineRaw(name)
    }
  }
  for (const v of Object.values(o)) {
    if (typeof v === 'object' && v != null) {
      const n = walkJsonLdForProductName(v, depth + 1)
      if (n) return n
    }
  }
  return null
}

function extractJsonLdProductName(html: string): string | null {
  const scripts = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const m of scripts) {
    try {
      const j = JSON.parse(m[1]!.trim()) as unknown
      const n = walkJsonLdForProductName(j, 0)
      if (n) return n
    } catch {
      /* skip */
    }
  }
  return null
}

export function modetourBaselineAcceptableForConfirm(trace: ModetourBaselineTrace | null | undefined): boolean {
  if (!trace?.cleaned?.trim()) return false
  const c = trace.cleaned.trim()
  if (isModetourWeakBaselineTitleText(c)) return false
  return modetourBaselineTitleHasProductSignals(c)
}

function extractBaselineFromDetailHtml(html: string | null, productNo: string | null): ModetourBaselineExtraction {
  if (!html?.trim()) {
    console.info('[MODETOUR_BASELINE_SOURCE_FINAL] pickedSource=none reason=no_html')
    return { layers: modetourRefineTitleLayers(buildDepartureTitleLayers('')), trace: null }
  }

  const candidates: Array<{ source: ModetourBaselineTitlePick; raw: string }> = []

  const h1Product =
    html.match(/<h[12][^>]*class="[^"]*product[^"]*tit[^"]*"[^>]*>([\s\S]*?)<\/h[12]>/i)?.[1] ??
    html.match(/<h[12][^>]*class="[^"]*product_tit[^"]*"[^>]*>([\s\S]*?)<\/h[12]>/i)?.[1]
  if (h1Product?.trim()) {
    candidates.push({ source: 'h1.product_tit', raw: normalizeBaselineRaw(stripTags(h1Product)) })
  }

  const h1Generic = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
  if (h1Generic?.trim()) {
    const r = normalizeBaselineRaw(stripTags(h1Generic))
    const last = candidates[candidates.length - 1]
    if (!last || last.raw !== r) candidates.push({ source: 'h1', raw: r })
  }

  const metaTitle =
    html.match(/<meta[^>]+name=["']title["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']title["']/i)?.[1]
  if (metaTitle?.trim()) {
    candidates.push({ source: 'meta.title', raw: normalizeBaselineRaw(metaTitle) })
  }

  const jsonLdName = extractJsonLdProductName(html)
  if (jsonLdName?.trim()) {
    candidates.push({ source: 'jsonld.product_name', raw: jsonLdName })
  }

  const docTitleRaw = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  if (docTitleRaw?.trim()) {
    const dt = normalizeBaselineRaw(stripTags(docTitleRaw))
    if (dt && !isModetourDocumentTitleLikelyContaminated(docTitleRaw)) {
      candidates.push({ source: 'document.title', raw: dt })
    } else if (dt) {
      console.info(
        `[MODETOUR_BASELINE_REJECTED] source=document.title reason=likely_breadcrumb_or_contaminated raw=${JSON.stringify(dt.slice(0, 200))}`
      )
    }
  }

  const og =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1]
  if (og?.trim()) {
    const r = normalizeBaselineRaw(og)
    if (!isModetourWeakBaselineTitleText(r)) candidates.push({ source: 'og:title', raw: r })
    else
      console.info(
        `[MODETOUR_BASELINE_REJECTED] source=og:title reason=weak_meta_date_code_or_short raw=${JSON.stringify(r.slice(0, 200))}`
      )
  }

  const tw =
    html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:title["']/i)?.[1]
  if (tw?.trim()) {
    const r = normalizeBaselineRaw(tw)
    if (!isModetourWeakBaselineTitleText(r)) candidates.push({ source: 'twitter:title', raw: r })
    else
      console.info(
        `[MODETOUR_BASELINE_REJECTED] source=twitter:title reason=weak_meta_date_code_or_short raw=${JSON.stringify(r.slice(0, 200))}`
      )
  }

  for (const c of candidates) {
    const raw = c.raw.trim()
    console.info(`[MODETOUR_BASELINE_RAW] source=${c.source} text=${JSON.stringify(raw.slice(0, 240))}`)
    if (isModetourWeakBaselineTitleText(raw)) {
      console.info(
        `[MODETOUR_BASELINE_REJECTED] source=${c.source} reason=weak_raw_pattern raw=${JSON.stringify(raw.slice(0, 200))}`
      )
      continue
    }
    const cleaned = cleanModetourBaselineTitleSource(raw, productNo)
    console.info(`[MODETOUR_BASELINE_CLEAN] source=${c.source} text=${JSON.stringify(cleaned.slice(0, 240))}`)
    if (isModetourWeakBaselineTitleText(cleaned)) {
      console.info(
        `[MODETOUR_BASELINE_REJECTED] source=${c.source} reason=weak_after_clean raw=${JSON.stringify(cleaned.slice(0, 200))}`
      )
      continue
    }
    if (!modetourBaselineTitleHasProductSignals(cleaned)) {
      console.info(
        `[MODETOUR_BASELINE_REJECTED] source=${c.source} reason=no_product_name_signals raw=${JSON.stringify(cleaned.slice(0, 200))}`
      )
      continue
    }
    console.info(
      `[MODETOUR_BASELINE_SOURCE_FINAL] pickedSource=${c.source} raw=${JSON.stringify(raw.slice(0, 120))} cleaned=${JSON.stringify(cleaned.slice(0, 120))}`
    )
    return {
      layers: modetourRefineTitleLayers(buildDepartureTitleLayers(cleaned)),
      trace: { pickedSource: c.source, raw, cleaned },
    }
  }

  console.info('[MODETOUR_BASELINE_SOURCE_FINAL] pickedSource=none reason=no_acceptable_candidate')
  return { layers: modetourRefineTitleLayers(buildDepartureTitleLayers('')), trace: null }
}

/** API row 에서 후보 제목/항공/가격 외 필드 추출 (키 이름 변형 허용) */
function pickRowString(row: ModetourDepartureRow, keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k]
    if (v != null && String(v).trim()) return String(v).trim()
  }
  return null
}

function rowTitleLayers(row: ModetourDepartureRow, baseline: DepartureTitleLayers): DepartureTitleLayers {
  const titleRaw =
    pickRowString(row, [
      'productName',
      'packageName',
      'goodsName',
      'title',
      'productTitle',
      'saleProductName',
    ]) || baseline.rawTitle
  return modetourRefineTitleLayers(buildDepartureTitleLayers(titleRaw))
}

function rowCarrierName(row: ModetourDepartureRow): string | null {
  return (
    pickRowString(row, [
      'airLineName',
      'airlineName',
      'carrierName',
      'airName',
      'transName',
      'airline',
    ]) || null
  )
}

function rowTripNightsDays(row: ModetourDepartureRow, baselineN: number | null, baselineD: number | null) {
  const t = pickRowString(row, ['tripText', 'scheduleText', 'nightDayText', 'durationText'])
  if (t) {
    const p = parseTripNightsDays(t)
    if (p.tripNights != null && p.tripDays != null) return p
  }
  const n = toNum(row.nightCount ?? row.tripNight ?? row.nights)
  const d = toNum(row.dayCount ?? row.tripDay ?? row.days)
  if (n != null && d != null) return { tripNights: n, tripDays: d }
  return { tripNights: baselineN, tripDays: baselineD }
}

function isoDateTimeFromRow(departureDate: string, timeRaw: string | null): string | null {
  if (!timeRaw || !/^\d{4}-\d{2}-\d{2}$/.test(departureDate)) return null
  const t = timeRaw.trim()
  const m = t.match(/(\d{1,2}):(\d{2})/)
  if (!m) return null
  return `${departureDate} ${String(Number(m[1])).padStart(2, '0')}:${m[2]}`
}

function extractPidDetailExtra(
  res: ModetourDetailInfoResponse['result']
): Partial<DepartureInput> & { outboundDepartureAt?: string | null; inboundArrivalAt?: string | null } {
  if (!res) return {}
  const r = res as Record<string, unknown>
  const carrier =
    pickRowString(r as ModetourDepartureRow, ['airLineName', 'airlineName', 'carrierName']) || null
  const statusRaw =
    (r.reserveStatusKorean as string) || (r.reserveStatus as string) || (r.statusName as string) || null
  const seatsNum = toNum(r.availableSeatNumber)
  const bookingSeatNum = toNum(r.bookingSeatNumber)
  const seatsStatusRaw =
    seatsNum != null
      ? `잔여${seatsNum}`
      : bookingSeatNum != null
        ? `예약${bookingSeatNum}`
        : null
  const minPax = toNum(r.minimumDepartureNumberOfPeople)
  const depDate = String(r.departureDate ?? '').slice(0, 10)
  const outTime = pickRowString(r as ModetourDepartureRow, ['departureTime', 'outboundTime', 'depTime'])
  const inTime = pickRowString(r as ModetourDepartureRow, ['arrivalTime', 'inboundTime', 'arrTime'])
  const arrDate = String((r as { arrivalDate?: string }).arrivalDate ?? depDate).slice(0, 10)

  return {
    carrierName: carrier,
    outboundDepartureAt: isoDateTimeFromRow(depDate, outTime),
    inboundArrivalAt: isoDateTimeFromRow(arrDate || depDate, inTime),
    statusRaw: statusRaw?.trim() || null,
    seatsStatusRaw,
    minPax: minPax ?? undefined,
    reservationCount: toNum(r.reservationCount ?? r.bookingCount) ?? undefined,
    seatCount: seatsNum ?? toNum(r.seatCount) ?? undefined,
  }
}

function rowMatchesBaseline(
  candidate: DepartureTitleLayers,
  carrier: string | null,
  tn: number | null,
  td: number | null,
  baseline: DepartureTitleLayers,
  baselineCarrier: string | null,
  baselineTn: number | null,
  baselineTd: number | null
): { pass: boolean; failReason?: string } {
  if (candidate.comparisonTitleNoSpace !== baseline.comparisonTitleNoSpace) {
    return { pass: false, failReason: 'comparison_title_no_space_mismatch' }
  }
  if (baselineCarrier && carrier && baselineCarrier.trim() !== carrier.trim()) {
    return { pass: false, failReason: 'carrier_mismatch' }
  }
  if (baselineTn != null && tn != null && baselineTn !== tn) return { pass: false, failReason: 'trip_nights_mismatch' }
  if (baselineTd != null && td != null && baselineTd !== td) return { pass: false, failReason: 'trip_days_mismatch' }
  return { pass: true }
}

function scoreInputRichness(i: DepartureInput): number {
  let s = 0
  if (i.adultPrice != null && i.adultPrice > 0) s += 4
  if (i.outboundDepartureAt) s += 2
  if (i.carrierName?.trim()) s += 2
  if (i.statusRaw?.trim()) s += 1
  if (i.seatsStatusRaw?.trim()) s += 1
  return s
}

function dedupeDepartures(inputs: DepartureInput[]): DepartureInput[] {
  const byKey = new Map<string, DepartureInput>()
  for (const input of inputs) {
    const d = String(input.departureDate ?? '').slice(0, 10)
    const layers = input.matchingTraceRaw
      ? (() => {
          try {
            const j = JSON.parse(input.matchingTraceRaw!) as { candidate?: DepartureTitleLayers }
            return j.candidate?.comparisonTitleNoSpace ?? ''
          } catch {
            return ''
          }
        })()
      : ''
    const carrier = String(input.carrierName ?? '').trim()
    const outAt = String(input.outboundDepartureAt ?? '').trim()
    const key = `${d}|${layers}|${carrier}|${outAt}`
    const prev = byKey.get(key)
    if (!prev || scoreInputRichness(input) >= scoreInputRichness(prev)) byKey.set(key, input)
  }
  return [...byKey.values()].sort((a, b) =>
    String(a.departureDate).localeCompare(String(b.departureDate))
  )
}

export async function collectModetourProductCore(
  originUrl: string | null | undefined
): Promise<{ product: ModetourProductCore | null; notes: string[] }> {
  const notes: string[] = []
  const productNo = parseProductNo(originUrl)
  if (!productNo) return { product: null, notes: ['modetour originUrl에서 productNo를 추출하지 못함'] }

  const referer = originUrl?.trim() || `https://www.modetour.com/package/${productNo}`
  const html = await fetchDetailHtml(referer, productNo)
  const text = html ? stripTags(html) : ''
  const baselineEx = extractBaselineFromDetailHtml(html, productNo)
  const layers = baselineEx.layers
  const nd = parseTripNightsDaysFromModetourPage(text, html)
  const carrierFromDetail = extractModetourBaselineCarrier(html, text)
  const shoppingVisitCountTotal = Number(text.match(/쇼핑\s*(\d+)\s*회/)?.[1] ?? 0) || null
  const noShoppingFlag = /노쇼핑|쇼핑\s*없음/i.test(text) ? true : shoppingVisitCountTotal === 0 ? null : false
  const noOptionFlag = /선택관광\s*없음|노옵션/i.test(text) ? true : null
  const freeDayIncludedFlag = /자유일정|자유\s*일정/i.test(text) ? true : null
  const optionalTourSummaryRaw = text.match(/(선택관광[\s\S]{0,280})/i)?.[1]?.trim() ?? null
  const mandatory = text.match(/(가이드|기사)\s*경비[^0-9\uAC00]*([0-9,]+)\s*([^\s.,]+)?/i)
  const shoppingShopOptions =
    text.match(/쇼핑[\s\S]{0,400}(?:환불|소요|분)/i)?.[0]?.trim() ?? null

  const product: ModetourProductCore = {
    originSource: 'MODETOUR',
    originCode: productNo,
    originUrl: referer,
    supplierGroupId: null,
    supplierProductCode: productNo,
    rawTitle: layers.rawTitle,
    preHashTitle: layers.preHashTitle,
    comparisonTitle: layers.comparisonTitle,
    comparisonTitleNoSpace: layers.comparisonTitleNoSpace,
    title: layers.preHashTitle || layers.rawTitle,
    primaryDestination: text.match(/(여행지|방문도시|목적지)\s*[:：]?\s*([^\n|]+)/)?.[2]?.trim() ?? null,
    destinationRaw: text.match(/(여행지|방문도시)\s*[:：]?\s*([^\n|]+)/)?.[2]?.trim() ?? null,
    imageUrl: html?.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1]?.trim() ?? null,
    productType: text.match(/(패키지|에어텔|허니문|골프)/)?.[1]?.trim() ?? null,
    summary: text.match(/(상품\s*소개|상품\s*요약)[\s\S]{0,240}/i)?.[0]?.trim() ?? null,
    benefitSummary: text.match(/(혜택|프로모션)[\s\S]{0,180}/i)?.[1]?.trim() ?? null,
    airline:
      carrierFromDetail ??
      text.match(/(대한항공|아시아나항공|제주항공|진에어|티웨이항공|에어부산|에어서울|이스타항공)/)?.[1] ??
      null,
    duration: nd.tripNights != null && nd.tripDays != null ? `${nd.tripNights}박 ${nd.tripDays}일` : null,
    tripNights: nd.tripNights,
    tripDays: nd.tripDays,
    shoppingVisitCountTotal,
    meetingInfoRaw:
      buildDepartureTerminalInfo(
        inferDepartureAirportCodeFromKoreanDetailText(text),
        carrierFromDetail ??
          text.match(/(대한항공|아시아나항공|제주항공|진에어|티웨이항공|에어부산|에어서울|이스타항공)/)?.[1] ??
          null
      ) ?? null,
    guideTypeRaw: text.match(/(현지\s*가이드|인솔자)[^\n]{0,100}/i)?.[0]?.trim() ?? null,
    tourLeaderTypeRaw: text.match(/(인솔자\s*동행|인솔\s*예정|무인솔)/i)?.[0]?.trim() ?? null,
    mandatoryLocalFee: mandatory?.[2] ? Number(String(mandatory[2]).replace(/,/g, '')) : null,
    mandatoryCurrency: mandatory?.[3]?.trim() || null,
    includedText: text.match(/(?:포함사항|포함내역)\s*[:：]?\s*([\s\S]{0,480})(?:불포함|예약안내|유의사항)/i)?.[1]?.trim() ?? null,
    excludedText: text.match(/(?:불포함사항|불포함내역)\s*[:：]?\s*([\s\S]{0,480})(?:예약안내|유의사항|선택관광)/i)?.[1]?.trim() ?? null,
    criticalExclusions: text.match(/(유류할증료|가이드\s*경비|현지\s*지불)[\s\S]{0,120}/i)?.[0]?.trim() ?? null,
    optionalTourSummaryRaw,
    hasOptionalTours: optionalTourSummaryRaw ? !/없음|노옵션/.test(optionalTourSummaryRaw) : null,
    cardBenefitSummaryShort: text.match(/(카드\s*혜택[\s\S]{0,120})/i)?.[1]?.trim() ?? null,
    registrationStatus: 'pending',
    themeLabelsRaw: null,
    promotionLabelsRaw: null,
    insuranceSummaryRaw: text.match(/(여행자\s*보험[\s\S]{0,200})/i)?.[1]?.trim() ?? null,
    hotelSummaryRaw: text.match(/(숙소|호텔)[\s\S]{0,240}/i)?.[0]?.trim() ?? null,
    foodSummaryRaw: text.match(/(식사[\s\S]{0,220})/i)?.[1]?.trim() ?? null,
    reservationNoticeRaw: text.match(/(예약\s*안내|예약\s*시\s*유의)[\s\S]{0,240}/i)?.[0]?.trim() ?? null,
    rawMeta: JSON.stringify({
      source: 'modetour_detail_html',
      extractedAt: new Date().toISOString(),
      shoppingShopOptions: shoppingShopOptions ? { raw: shoppingShopOptions } : undefined,
      notes: [
        'ProductDeparture.adultPrice uses GetOtherDepartureDates.minPrice only (popup row equivalent)',
        'detail_page_price_and_fuel_not_used_for_departure_adultPrice',
      ],
    }),
    noShoppingFlag,
    noOptionFlag,
    freeDayIncludedFlag,
  }

  if (baselineEx.trace) {
    notes.push(
      `[MODETOUR_BASELINE_RAW] source=${baselineEx.trace.pickedSource} text=${JSON.stringify(baselineEx.trace.raw)}`
    )
    notes.push(`[MODETOUR_BASELINE_CLEAN] ${JSON.stringify(baselineEx.trace.cleaned)}`)
  }
  notes.push(
    `[MODETOUR_BASELINE_META] carrier_name=${product.airline ?? ''} trip_nights=${product.tripNights ?? ''} trip_days=${product.tripDays ?? ''}`
  )
  notes.push(
    `[SCRAPER_BASELINE] raw_title=${product.rawTitle} pre_hash_title=${product.preHashTitle} comparison_title=${product.comparisonTitle} comparison_title_no_space=${product.comparisonTitleNoSpace} carrier_name=${product.airline ?? ''} trip_nights=${product.tripNights ?? ''} trip_days=${product.tripDays ?? ''}`
  )
  return { product, notes }
}

export async function collectModetourDepartureInputs(
  originUrl: string | null | undefined,
  options?: {
    monthsForward?: number
    referer?: string
    singleDateYmd?: string
    /** on-demand 범위: API `searchFrom`/`searchTo`를 이 구간으로 고정(YYYY-MM-DD, inclusive). */
    dateRangeYmd?: { from: string; to: string }
  }
): Promise<{
  inputs: DepartureInput[]
  meta: ModetourCollectMeta
  pricePromotionFromDom: PricePromotionSnapshot | null
  baselineTrace: ModetourBaselineTrace | null
}> {
  const productNo = parseProductNo(originUrl)
  if (!productNo) {
    return {
      inputs: [],
      meta: {
        filledFields: [],
        missingFields: ['departureDate', 'adultPrice', 'statusRaw', 'seatsStatusRaw', 'minPax'],
        mappingStatus: 'price-only-confirmed',
        notes: ['modetour originUrl에서 productNo를 추출하지 못함'],
      },
      pricePromotionFromDom: null,
      baselineTrace: null,
    }
  }

  const referer = options?.referer?.trim() || originUrl?.trim() || `https://www.modetour.com/package/${productNo}`
  const headers = toHeader(referer, productNo)

  const monthsForward = Math.max(1, Math.min(18, options?.monthsForward ?? SCRAPE_DEFAULT_MONTHS_FORWARD))
  const todayYmd = scrapeCalendarTodayYmd()
  const singleYmd = (options?.singleDateYmd ?? '').trim()
  const useSingleDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(singleYmd)
  const dr = options?.dateRangeYmd
  const rangeFromRaw = (dr?.from ?? '').trim()
  const rangeToRaw = (dr?.to ?? '').trim()
  const useDateRange =
    dr != null &&
    /^\d{4}-\d{2}-\d{2}$/.test(rangeFromRaw) &&
    /^\d{4}-\d{2}-\d{2}$/.test(rangeToRaw)
  const [y0, m0, d0] = todayYmd.split('-').map(Number)
  const rangeAnchor = new Date(Date.UTC(y0, m0 - 1, d0))
  const rangeEnd = addMonths(rangeAnchor, monthsForward)
  const searchFrom = useDateRange
    ? rangeFromRaw <= rangeToRaw
      ? rangeFromRaw
      : rangeToRaw
    : useSingleDateOnly
      ? singleYmd
      : todayYmd
  const searchTo = useDateRange
    ? rangeFromRaw <= rangeToRaw
      ? rangeToRaw
      : rangeFromRaw
    : useSingleDateOnly
      ? singleYmd
      : toYmd(rangeEnd)

  const apiUrl = `${MODETOUR_API_BASE.replace(/\/$/, '')}/Package/GetOtherDepartureDates?productNo=${encodeURIComponent(productNo)}&searchFrom=${searchFrom}&searchTo=${searchTo}`
  const detailUrlBase = `${MODETOUR_API_BASE.replace(/\/$/, '')}/Package/GetProductDetailInfo?productNo=${encodeURIComponent(productNo)}&companyNo=undefined&companyStaffNo=undefined`
  const packageUrl = `${MODETOUR_API_BASE.replace(/\/$/, '')}/Package/GetPackageInfo?productNo=${encodeURIComponent(productNo)}`

  const [detailHtml, json] = await Promise.all([
    fetchDetailHtml(referer, productNo),
    fetchJson<ModetourDepartureResponse>(apiUrl, headers),
  ])
  const pricePromotionFromDom = detailHtml ? extractPricePromotionFromHtml(detailHtml) : null
  const detailText = detailHtml ? stripTags(detailHtml) : ''
  const baselineExtraction = extractBaselineFromDetailHtml(detailHtml, productNo)
  const baselineLayers = baselineExtraction.layers
  const baselineNd = parseTripNightsDaysFromModetourPage(detailText, detailHtml)
  const baselineCarrier = extractModetourBaselineCarrier(detailHtml, detailText)

  const rows = Array.isArray(json?.result) ? json.result : []

  const [detailWrap, packageWrap] = await Promise.all([
    fetchJson<ModetourDetailInfoResponse>(detailUrlBase, headers).catch(() => ({ result: null as ModetourDetailInfoResponse['result'] | null })),
    fetchJson<ModetourPackageInfoResponse>(packageUrl, headers).catch(() => ({ result: null as ModetourPackageInfoResponse['result'] | null })),
  ])
  let detail: ModetourDetailInfoResponse['result'] | null = detailWrap.result ?? null
  let packageInfo: ModetourPackageInfoResponse['result'] | null = packageWrap.result ?? null

  const pidCache = new Map<string, ModetourDetailInfoResponse['result'] | null>()
  async function getPidDetail(pid: string): Promise<ModetourDetailInfoResponse['result'] | null> {
    if (pidCache.has(pid)) return pidCache.get(pid) ?? null
    try {
      const u = `${detailUrlBase}&pId=${encodeURIComponent(pid)}`
      const r = await fetchJson<ModetourDetailInfoResponse>(u, headers)
      pidCache.set(pid, r.result ?? null)
      return r.result ?? null
    } catch {
      pidCache.set(pid, null)
      return null
    }
  }

  const notes: string[] = []
  if (baselineExtraction.trace) {
    notes.push(
      `[MODETOUR_BASELINE_RAW] source=${baselineExtraction.trace.pickedSource} text=${JSON.stringify(baselineExtraction.trace.raw)}`
    )
    notes.push(`[MODETOUR_BASELINE_CLEAN] ${JSON.stringify(baselineExtraction.trace.cleaned)}`)
  }
  notes.push(
    `[MODETOUR_BASELINE_META] carrier_name=${baselineCarrier ?? ''} trip_nights=${baselineNd.tripNights ?? ''} trip_days=${baselineNd.tripDays ?? ''}`
  )
  notes.push(
    `[SCRAPER_BASELINE] raw_title=${baselineLayers.rawTitle} pre_hash_title=${baselineLayers.preHashTitle} comparison_title=${baselineLayers.comparisonTitle} comparison_title_no_space=${baselineLayers.comparisonTitleNoSpace} carrier_name=${baselineCarrier ?? ''} trip_nights=${baselineNd.tripNights ?? ''} trip_days=${baselineNd.tripDays ?? ''}`
  )
  notes.push(
    `[SCRAPER_DATE_CLICK] clicked_date=multi refresh_detected=true visible_month_labels=${searchFrom.slice(0, 7)}..${searchTo.slice(0, 7)} processed_date_count=${rows.length}`
  )
  notes.push(
    `[SCRAPER_KST_RANGE] today=${todayYmd} searchFrom=${searchFrom} searchTo=${searchTo} months_forward=${monthsForward} policy=departures_on_or_after_kst_today`
  )

  type MatchedModetourRow = {
    r: ModetourDepartureRow
    departureDate: string
    price: number
    pid: string
    candidateLayers: DepartureTitleLayers
    carrierFromRow: string | null
    tripNights: number | null
    tripDays: number | null
    rowCcy: string | null
  }

  const matchedRows: MatchedModetourRow[] = []

  for (const r of rows) {
    const departureDate = String(r.departureDate ?? '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(departureDate)) continue

    const price = Number(r.minPrice ?? 0)
    if (!Number.isFinite(price) || price <= 0) continue

    const pid = String(r.pId ?? '').trim()
    const candidateLayers = rowTitleLayers(r, baselineLayers)
    const carrierFromRow = rowCarrierName(r)
    const { tripNights, tripDays } = rowTripNightsDays(r, baselineNd.tripNights, baselineNd.tripDays)

    const match = rowMatchesBaseline(
      candidateLayers,
      carrierFromRow,
      tripNights,
      tripDays,
      baselineLayers,
      baselineCarrier,
      baselineNd.tripNights,
      baselineNd.tripDays
    )

    const rowCcy = modetourRowCurrencyCode(r)
    notes.push(
      `[MODETOUR_DEPARTURE_MATCH] departure_date=${departureDate} result=${match.pass ? 'matched' : 'unmatched'} reason=${match.failReason ?? 'none'}`
    )
    notes.push(
      `[SCRAPER_CANDIDATE] candidate_raw_title=${candidateLayers.rawTitle} candidate_comparison_title=${candidateLayers.comparisonTitle} candidate_comparison_title_no_space=${candidateLayers.comparisonTitleNoSpace} candidate_carrier=${carrierFromRow ?? ''} candidate_departure_date=${departureDate} candidate_outbound_departure_at= candidate_price=${price} candidate_currency=${rowCcy ?? ''} match_result=${match.pass ? 'pass' : 'fail'} fail_reason=${match.failReason ?? ''}`
    )

    if (!match.pass) continue

    matchedRows.push({
      r,
      departureDate,
      price,
      pid,
      candidateLayers,
      carrierFromRow,
      tripNights,
      tripDays,
      rowCcy,
    })
  }

  const uniquePidCount = new Set(matchedRows.map((m) => m.pid).filter(Boolean)).size
  notes.push(
    `[SCRAPER_PERF] pId_prefetch=chunked_parallel chunk_size=${MODETOUR_PID_PREFETCH_CHUNK} unique_pids=${uniquePidCount} matched_rows=${matchedRows.length}`
  )
  await prefetchPidDetailsInChunks(matchedRows.map((m) => m.pid), (pid) => getPidDetail(pid))

  const built: DepartureInput[] = []
  let beforeDedupe = 0

  for (const row of matchedRows) {
    const { r, departureDate, price, pid, candidateLayers, carrierFromRow, rowCcy } = row

    let extra: Partial<DepartureInput> = {}
    if (pid) {
      const pidRes = await getPidDetail(pid)
      extra = extractPidDetailExtra(pidRes)
      notes.push(`[SCRAPER_SELECTED] clicked_date=${departureDate} selected_comparison_title=${candidateLayers.comparisonTitle} selected_carrier=${extra.carrierName ?? carrierFromRow ?? ''} selected_outbound_departure_at=${String(extra.outboundDepartureAt ?? '')} selected_price=${price} selected_reason=pId_detail_enrich_or_row`)
    } else {
      notes.push(
        `[SCRAPER_SELECTED] clicked_date=${departureDate} selected_comparison_title=${candidateLayers.comparisonTitle} selected_carrier=${carrierFromRow ?? ''} selected_outbound_departure_at= selected_price=${price} selected_reason=api_row_only`
      )
    }

    const carrierName = (extra.carrierName as string | undefined) ?? carrierFromRow ?? baselineCarrier ?? undefined
    const outboundDepartureAt = extra.outboundDepartureAt ?? undefined
    const inboundArrivalAt = extra.inboundArrivalAt ?? undefined

    const matchingTraceRaw = buildCommonMatchingTrace({
      source: 'modetour_get_other_departure_dates',
      supplier: 'modetour',
      baseline: baselineLayers,
      candidate: candidateLayers,
      notes: [
        'price_ssot=api_row_minPrice_equivalent_to_popup_right_row',
        rowCcy ? `row_currency=${rowCcy}` : 'row_currency=(api_row_unspecified)',
        '[SCRAPER_DEDUPE] dedupe_key=departureDate+comparisonTitleNoSpace+carrierName+outboundDepartureAt',
        'calendar_cell_price_not_used',
      ],
      productNo,
      pId: pid || null,
    })

    const sr = extra.statusRaw ?? null
    const input: DepartureInput = {
      departureDate,
      adultPrice: price,
      carrierName: carrierName ?? null,
      outboundDepartureAt,
      inboundArrivalAt,
      statusRaw: sr,
      statusLabelsRaw: sr ? JSON.stringify([sr]) : null,
      seatsStatusRaw: extra.seatsStatusRaw ?? null,
      minPax: extra.minPax ?? null,
      reservationCount: extra.reservationCount ?? null,
      seatCount: extra.seatCount ?? null,
      supplierDepartureCodeCandidate: pid ? `modetour:${pid}` : null,
      matchingTraceRaw,
      localPriceText: buildModetourLocalPriceText(pid, r),
    }
    built.push(input)
    beforeDedupe += 1
  }

  const afterFloor = filterDepartureInputsOnOrAfterCalendarToday(applyDepartureTerminalMeetingInfo(built))
  notes.push(
    `[SCRAPER_DATE_FLOOR] kst_today=${todayYmd} raw_rows=${beforeDedupe} after_today_filter=${afterFloor.length}`
  )
  const inputs = dedupeDepartures(afterFloor)
  notes.push(
    `[SCRAPER_DEDUPE] before_count=${afterFloor.length} after_count=${inputs.length} dedupe_key=departureDate+comparisonTitleNoSpace+carrierName+outboundDepartureAt`
  )

  const samplePids = Array.from(
    new Set(inputs.map((x) => parseLocalPid(x.localPriceText)).filter((v): v is string => Boolean(v)))
  ).slice(0, 3)
  let pidJoinAvailable = false
  if (samplePids.length >= 2) {
    try {
      const depDates = await Promise.all(
        samplePids.map(async (pid) => {
          const d = await getPidDetail(pid)
          return String(d?.departureDate ?? '')
        })
      )
      pidJoinAvailable = new Set(depDates).size > 1
      if (!pidJoinAvailable) {
        notes.push('GetProductDetailInfo?pId=... 응답이 동일하여 pId별 상태/좌석/최소출발인원 join 불가')
      }
    } catch {
      notes.push('pId detail join probe failed')
    }
  }

  const detailDate = String(detail?.departureDate ?? '')
  const statusRaw = (detail?.reserveStatusKorean ?? detail?.reserveStatus ?? null)?.toString().trim() || null
  const seatsNum = toNum(detail?.availableSeatNumber)
  const bookingSeatNum = toNum(detail?.bookingSeatNumber)
  const minPax = toNum(detail?.minimumDepartureNumberOfPeople) ?? toNum(packageInfo?.booking?.minSeat)
  const seatsStatusRawGlob =
    seatsNum != null
      ? `잔여${seatsNum}`
      : bookingSeatNum != null
        ? `예약${bookingSeatNum}`
        : toNum(packageInfo?.booking?.restSeat) != null
          ? `잔여${toNum(packageInfo?.booking?.restSeat)}`
          : null

  if (detailDate || statusRaw || seatsStatusRawGlob || minPax) {
    notes.push(
      `detail 후보값 확인됨(departureDate=${detailDate || 'N/A'}, status=${statusRaw || 'N/A'}, seats=${seatsStatusRawGlob || 'N/A'}, minPax=${minPax ?? 'N/A'})`
    )
  }

  let inputsOut = inputs
  if (useDateRange) {
    const lo = searchFrom
    const hi = searchTo
    inputsOut = inputs.filter((x) => {
      const d = departureInputToYmd(x.departureDate)
      return d != null && d >= lo && d <= hi
    })
  } else if (useSingleDateOnly) {
    const hit = inputs.filter((x) => departureInputToYmd(x.departureDate) === singleYmd)
    if (hit.length > 0) {
      inputsOut = hit.slice(0, 1)
    } else {
      const raw = rows.find((r) => String(r.departureDate ?? '').trim() === singleYmd)
      if (raw) {
        const price = Number(raw.minPrice ?? 0)
        inputsOut = [
          {
            departureDate: singleYmd,
            adultPrice: Number.isFinite(price) && price > 0 ? price : null,
            carrierName: rowCarrierName(raw) ?? null,
            supplierDepartureCodeCandidate: raw.pId ? `modetour:${String(raw.pId)}` : null,
            matchingTraceRaw: JSON.stringify({ source: 'modetour_on_demand_api_row', singleYmd }),
          },
        ]
      } else {
        inputsOut = []
      }
    }
  }

  const fieldStats = {
    departureDate: inputsOut.some((x) => !!x.departureDate),
    adultPrice: inputsOut.some((x) => (x.adultPrice ?? 0) > 0),
    carrierName: inputsOut.some((x) => !!x.carrierName),
    outboundDepartureAt: inputsOut.some((x) => !!x.outboundDepartureAt),
    inboundArrivalAt: inputsOut.some((x) => !!x.inboundArrivalAt),
    statusRaw: inputsOut.some((x) => !!x.statusRaw),
    statusLabelsRaw: inputsOut.some((x) => !!x.statusLabelsRaw),
    seatsStatusRaw: inputsOut.some((x) => !!x.seatsStatusRaw),
    minPax: inputsOut.some((x) => (x.minPax ?? 0) > 0),
    supplierDepartureCodeCandidate: inputsOut.some((x) => !!x.supplierDepartureCodeCandidate),
    matchingTraceRaw: inputsOut.some((x) => !!x.matchingTraceRaw),
  }
  const filledFields = Object.entries(fieldStats)
    .filter(([, ok]) => ok)
    .map(([k]) => k)
  const missingFields = Object.entries(fieldStats)
    .filter(([, ok]) => !ok)
    .map(([k]) => k)

  let mappingStatus: ModetourCollectMeta['mappingStatus'] = 'price-only-confirmed'
  if (pidJoinAvailable) {
    mappingStatus = 'per-date-confirmed'
  } else if (detailDate || statusRaw || seatsStatusRawGlob || minPax) {
    mappingStatus = 'detail-candidate-found-but-unmapped'
  }

  if (!process.env.MODETOUR_WEB_API_REQ_HEADER) {
    notes.push('MODETOUR_WEB_API_REQ_HEADER 미설정: 내장 기본값 사용 중 (운영에서는 env 주입 권장)')
  }

  return {
    inputs: inputsOut,
    meta: {
      filledFields,
      missingFields,
      mappingStatus,
      notes,
    },
    pricePromotionFromDom,
    baselineTrace: baselineExtraction.trace,
  }
}

/** on-demand: `singleDateYmd` 하루만 API 범위로 조회한 뒤 동일 일자 행만 반환(0건이면 null). */
export async function collectModetourDepartureInputForSingleDate(
  originUrl: string | null | undefined,
  ymd: string
): Promise<DepartureInput | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  const r = await collectModetourDepartureInputs(originUrl, { singleDateYmd: ymd })
  const first = r.inputs[0]
  if (!first) return null
  return departureInputToYmd(first.departureDate) === ymd ? first : null
}

/** on-demand: inclusive `[fromYmd,toYmd]` API 조회 후 동일 구간 일자만 반환. */
export async function collectModetourDepartureInputsForDateRange(
  originUrl: string | null | undefined,
  fromYmd: string,
  toYmd: string
): Promise<DepartureInput[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(toYmd)) return []
  const lo = fromYmd <= toYmd ? fromYmd : toYmd
  const hi = fromYmd <= toYmd ? toYmd : fromYmd
  const r = await collectModetourDepartureInputs(originUrl, { dateRangeYmd: { from: lo, to: hi } })
  return r.inputs.filter((x) => {
    const d = departureInputToYmd(x.departureDate)
    return d != null && d >= lo && d <= hi
  })
}
