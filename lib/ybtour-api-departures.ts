/**
 * ybtour papi — evCd·goodsCd 가격·출발 메타 (브라우저가 호출하는 공개 JSON).
 *
 * REGRESSION-FREEZE[ybtour-api-departure-collect]: papi.ybtour.co.kr pkg/event — manifest
 * REGRESSION-FREEZE[ybtour-by-goods-departure-list]: by-goods 월별 다출발 — manifest
 */
import { departureInputToYmd } from '@/lib/scrape-date-bounds'
import type { DepartureInput } from '@/lib/upsert-product-departures-ybtour'

const YBTOUR_PAPI_BASE = process.env.YBTOUR_PAPI_BASE_URL ?? 'https://papi.ybtour.co.kr'

type YbtourPapiEnvelope<T> = {
  code?: string
  message?: string
  body?: T
}

export type YbtourEventPriceBody = {
  adtPrice?: number
  chdPrice?: number
  infPrice?: number
  bafAdtCost?: number
  bafChdCost?: number
  bafInfCost?: number
  airTaxAdtCost?: number
  airTaxChdCost?: number
  airTaxInfCost?: number
}

export type YbtourEventFirstDisplayBody = {
  evCd?: string
  evNm?: string
  evStartDt?: string
  dspSid1?: string
  dspSid2?: string
  dspSid3?: string
  dspSid4?: string
}

export type YbtourGoodsAvailableDateDayBody = {
  evCd?: string
  evStartDt?: string
  eventMonthList?: {
    minOutStartDt?: string
    maxOutStartDt?: string
  }
}

/** `/pkg/event/by-goods/{goodsCd}/{dspSid}/{YYYYMM}` 행 */
export type YbtourByGoodsEventRow = {
  outStartDt?: string
  outStartMonth?: string
  adtPrice?: number
  bafAdtPrice?: number
  airTaxAdtPrice?: number
  evCd?: string
  evNm?: string
  trCompanySnm?: string | null
}

function ybtourPapiHeaders(referer: string): HeadersInit {
  return {
    accept: 'application/json, text/plain, */*',
    'accept-language': 'ko-KR',
    referer,
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  }
}

async function fetchYbtourPapiJson<T>(path: string, referer: string): Promise<T | null> {
  const url = `${YBTOUR_PAPI_BASE.replace(/\/$/, '')}${path}`
  const res = await fetch(url, { method: 'GET', headers: ybtourPapiHeaders(referer) })
  if (!res.ok) return null
  const json = (await res.json()) as YbtourPapiEnvelope<T>
  if (json?.code !== '0000') return null
  return json.body ?? null
}

/** prdt/ybtour 상세 URL의 evCd 쿼리 */
export function parseYbtourEvCdFromUrl(url: string | null | undefined): string | null {
  const m = String(url ?? '').match(/[?&]evCd=([^&]+)/i)
  return m?.[1]?.trim() || null
}

/** prdt/ybtour 상세 URL의 goodsCd 쿼리 */
export function parseYbtourGoodsCdFromUrl(url: string | null | undefined): string | null {
  const m = String(url ?? '').match(/[?&]goodsCd=([^&]+)/i)
  return m?.[1]?.trim() || null
}

const YBTOUR_EVCD_SHAPE = /^([A-Z0-9]+)-(\d{6})/i

/** goodsCd가 evCd 형태(시리즈-YYMMDD…)인지 — by-goods에는 베이스 코드만 통함. */
export function ybtourGoodsCdLooksLikeEvCd(code: string | null | undefined): boolean {
  return YBTOUR_EVCD_SHAPE.test(String(code ?? '').trim())
}

/** evCd형 문자열 → 시리즈 베이스 (EEP1284-260703LO01 → EEP1284). */
export function parseYbtourBaseSeriesFromEvCdShape(code: string | null | undefined): string | null {
  const m = String(code ?? '').trim().match(YBTOUR_EVCD_SHAPE)
  return m?.[1]?.trim() || null
}

/** URL·DB originCode의 goodsCd를 by-goods·available-date용 베이스 코드로 정규화. */
export function normalizeYbtourGoodsCdForApi(
  rawGoodsCd: string | null | undefined,
  originCode?: string | null,
): string | null {
  const urlCd = String(rawGoodsCd ?? '').trim() || null
  const origin = String(originCode ?? '').trim() || null

  const toBase = (code: string): string => {
    if (ybtourGoodsCdLooksLikeEvCd(code)) {
      return parseYbtourBaseSeriesFromEvCdShape(code) ?? code
    }
    return code
  }

  if (urlCd) {
    if (ybtourGoodsCdLooksLikeEvCd(urlCd)) {
      if (origin && !ybtourGoodsCdLooksLikeEvCd(origin)) return origin
      return toBase(urlCd)
    }
    return urlCd
  }

  if (origin) return toBase(origin)
  return null
}

/** 상세 URL + originCode → papi by-goods용 goodsCd. */
export function resolveYbtourGoodsCdForApi(
  detailUrl: string,
  originCode?: string | null,
): string | null {
  const fromUrl = parseYbtourGoodsCdFromUrl(detailUrl)
  const normalized = normalizeYbtourGoodsCdForApi(fromUrl, originCode)
  if (normalized) return normalized

  const evCd = parseYbtourEvCdFromUrl(detailUrl)
  if (evCd) {
    const base = parseYbtourBaseSeriesFromEvCdShape(evCd)
    if (base) return base
  }

  return normalizeYbtourGoodsCdForApi(null, originCode)
}

/** YYYY-MM-DD 구간에 걸치는 YYYYMM 키 (by-goods 월 API용). */
export function ybtourMonthKeysForYmdWindow(fromYmd: string, toYmd: string): string[] {
  const lo = fromYmd <= toYmd ? fromYmd : toYmd
  const hi = fromYmd <= toYmd ? toYmd : fromYmd
  const keys = new Set<string>()
  let cur = lo
  for (let guard = 0; guard < 400 && cur <= hi; guard += 1) {
    keys.add(cur.slice(0, 7).replace('-', ''))
    const [y, m, d] = cur.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d))
    dt.setUTCDate(dt.getUTCDate() + 1)
    cur = dt.toISOString().slice(0, 10)
  }
  return [...keys].sort()
}

/** evCd 접미 `-YYMMDD` → 20YY-MM-DD (예: EEP1284-260703LO01 → 2026-07-03) */
export function parseYbtourDepartureYmdFromEvCd(evCd: string | null | undefined): string | null {
  const m = String(evCd ?? '').match(/-(\d{2})(\d{2})(\d{2})/)
  if (!m) return null
  const ymd = `20${m[1]}-${m[2]}-${m[3]}`
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null
}

export function ybtourYmdFromEvStartDt(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim()
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return null
}

export function resolveYbtourDepartureYmdForEvCd(
  evCd: string,
  display?: YbtourEventFirstDisplayBody | null,
): string | null {
  return ybtourYmdFromEvStartDt(display?.evStartDt) ?? parseYbtourDepartureYmdFromEvCd(evCd)
}

export async function fetchYbtourEventPrice(
  evCd: string,
  referer: string,
): Promise<YbtourEventPriceBody | null> {
  return fetchYbtourPapiJson<YbtourEventPriceBody>(
    `/pkg/event/${encodeURIComponent(evCd)}/price`,
    referer,
  )
}

export async function fetchYbtourEventFirstDisplay(
  evCd: string,
  referer: string,
): Promise<YbtourEventFirstDisplayBody | null> {
  return fetchYbtourPapiJson<YbtourEventFirstDisplayBody>(
    `/pkg/event/${encodeURIComponent(evCd)}/first-display`,
    referer,
  )
}

export async function fetchYbtourGoodsAvailableDateDay(
  goodsCd: string,
  referer: string,
): Promise<YbtourGoodsAvailableDateDayBody | null> {
  return fetchYbtourPapiJson<YbtourGoodsAvailableDateDayBody>(
    `/pkg/goods/${encodeURIComponent(goodsCd)}/available-date/day`,
    referer,
  )
}

export async function fetchYbtourEventByGoodsMonth(
  goodsCd: string,
  dspSid: string,
  monthKey: string,
  referer: string,
): Promise<YbtourByGoodsEventRow[]> {
  if (!/^\d{6}$/.test(monthKey)) return []
  const body = await fetchYbtourPapiJson<YbtourByGoodsEventRow[]>(
    `/pkg/event/by-goods/${encodeURIComponent(goodsCd)}/${encodeURIComponent(dspSid)}/${monthKey}`,
    referer,
  )
  return Array.isArray(body) ? body : []
}

/** first-display dspSid4 → dspSid3 (URL dspSid는 by-goods에 통하지 않음). */
export function resolveYbtourByGoodsDspSid(display: YbtourEventFirstDisplayBody | null): string | null {
  const s4 = String(display?.dspSid4 ?? '').trim()
  if (s4) return s4
  const s3 = String(display?.dspSid3 ?? '').trim()
  return s3 || null
}

export function ybtourByGoodsRowToAdultPrice(row: YbtourByGoodsEventRow | null | undefined): number | null {
  if (!row) return null
  const base = Number(row.adtPrice ?? 0)
  const baf = Number(row.bafAdtPrice ?? 0)
  const tax = Number(row.airTaxAdtPrice ?? 0)
  const total = base + (Number.isFinite(baf) ? baf : 0) + (Number.isFinite(tax) ? tax : 0)
  return Number.isFinite(total) && total > 0 ? total : null
}

export function ybtourByGoodsRowToDepartureInput(row: YbtourByGoodsEventRow | null | undefined): DepartureInput | null {
  if (!row) return null
  const evCd = String(row.evCd ?? '').trim()
  const departureDate = ybtourYmdFromEvStartDt(row.outStartDt)
  const adultPrice = ybtourByGoodsRowToAdultPrice(row)
  if (!evCd || !departureDate || adultPrice == null) return null
  return {
    departureDate,
    adultPrice,
    childBedPrice: null,
    infantPrice: null,
    carrierName: row.trCompanySnm?.trim() || null,
    supplierDepartureCodeCandidate: `ybtour:${evCd}`,
    localPriceText: `ybtour:by-goods evCd=${evCd}`.slice(0, 200),
  }
}

function dedupeYbtourInputsByEvCd(inputs: DepartureInput[]): DepartureInput[] {
  const seen = new Set<string>()
  const out: DepartureInput[] = []
  for (const x of inputs) {
    const code = String(x.supplierDepartureCodeCandidate ?? '')
    const key = code.startsWith('ybtour:') ? code : `${x.departureDate}:${x.adultPrice}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(x)
  }
  return out
}

/** URL evCd first-display 실패(9991 등) 시 available-date/day evCd로 by-goods dspSid seed. */
export function pickYbtourSeedEvCdForByGoods(params: {
  urlEvCd: string | null
  dayEvCd: string | null
  urlEvCdDspSid: string | null
}): string | null {
  const urlEvCd = String(params.urlEvCd ?? '').trim() || null
  const dayEvCd = String(params.dayEvCd ?? '').trim() || null
  const urlEvCdDspSid = String(params.urlEvCdDspSid ?? '').trim() || null
  if (urlEvCd && urlEvCdDspSid) return urlEvCd
  return dayEvCd || urlEvCd
}

async function resolveYbtourSeedEvCd(detailUrl: string, goodsCd: string, referer: string): Promise<string | null> {
  const fromUrl = parseYbtourEvCdFromUrl(detailUrl)
  const day = await fetchYbtourGoodsAvailableDateDay(goodsCd, referer)
  const fromDay = String(day?.evCd ?? '').trim() || null

  let urlEvCdDspSid: string | null = null
  if (fromUrl) {
    const display = await fetchYbtourEventFirstDisplay(fromUrl, referer)
    urlEvCdDspSid = resolveYbtourByGoodsDspSid(display)
  }

  return pickYbtourSeedEvCdForByGoods({
    urlEvCd: fromUrl,
    dayEvCd: fromDay,
    urlEvCdDspSid,
  })
}

function ybtourEvCdFromDepartureInput(input: DepartureInput): string | null {
  const code = String(input.supplierDepartureCodeCandidate ?? '')
  if (!code.startsWith('ybtour:')) return null
  const evCd = code.slice('ybtour:'.length).trim()
  return evCd || null
}

function mergeYbtourEvCdPriceIntoDepartureInput(
  base: DepartureInput,
  evCd: string,
  price: YbtourEventPriceBody,
): DepartureInput {
  const departureYmd = departureInputToYmd(base.departureDate)
  if (!departureYmd) return base
  const fromPrice = ybtourEventPriceToDepartureInput(evCd, price, departureYmd)
  if (!fromPrice) return base
  return {
    ...base,
    adultPrice: fromPrice.adultPrice ?? base.adultPrice,
    childBedPrice: fromPrice.childBedPrice ?? base.childBedPrice,
    infantPrice: fromPrice.infantPrice ?? base.infantPrice,
    localPriceText: `ybtour:by-goods+price evCd=${evCd}`.slice(0, 200),
  }
}

export type YbtourEvCdPriceEnrichOptions = {
  concurrency?: number
  pauseMs?: number
}

function ybtourEvCdPriceEnrichPauseMs(): number {
  const raw = Number(process.env.YBTOUR_EVCD_PRICE_ENRICH_PAUSE_MS ?? '120')
  return Number.isFinite(raw) && raw >= 0 ? raw : 120
}

function ybtourEvCdPriceEnrichConcurrency(): number {
  const raw = Number(process.env.YBTOUR_EVCD_PRICE_ENRICH_CONCURRENCY ?? '4')
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 4
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** by-goods 행에 evCd별 /price로 아동·유아가(및 성인가 교차) 보강. */
export async function enrichYbtourDepartureInputsWithEvCdPrice(
  inputs: DepartureInput[],
  referer: string,
  options?: YbtourEvCdPriceEnrichOptions,
): Promise<DepartureInput[]> {
  if (inputs.length === 0) return inputs

  const concurrency = Math.max(1, options?.concurrency ?? ybtourEvCdPriceEnrichConcurrency())
  const pauseMs = Math.max(0, options?.pauseMs ?? ybtourEvCdPriceEnrichPauseMs())
  const out = [...inputs]

  for (let start = 0; start < out.length; start += concurrency) {
    const slice = out.slice(start, start + concurrency)
    const enrichedSlice = await Promise.all(
      slice.map(async (input) => {
        const evCd = ybtourEvCdFromDepartureInput(input)
        if (!evCd) return input
        if (input.childBedPrice != null && input.infantPrice != null) return input

        const price = await fetchYbtourEventPrice(evCd, referer)
        if (!price) return input
        return mergeYbtourEvCdPriceIntoDepartureInput(input, evCd, price)
      }),
    )
    for (let j = 0; j < enrichedSlice.length; j += 1) {
      out[start + j] = enrichedSlice[j]!
    }
    if (start + concurrency < out.length && pauseMs > 0) {
      await sleepMs(pauseMs)
    }
  }

  return out
}

export function ybtourEventPriceToDepartureInput(
  evCd: string,
  price: YbtourEventPriceBody,
  departureYmd: string,
): DepartureInput | null {
  const adultBase = Number(price.adtPrice ?? 0)
  const baf = Number(price.bafAdtCost ?? 0)
  const airTax = Number(price.airTaxAdtCost ?? 0)
  const adultPrice =
    adultBase +
    (Number.isFinite(baf) ? baf : 0) +
    (Number.isFinite(airTax) ? airTax : 0)
  if (!Number.isFinite(adultPrice) || adultPrice <= 0) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(departureYmd)) return null

  const childBase = Number(price.chdPrice ?? 0)
  const childBaf = Number(price.bafChdCost ?? 0)
  const childTax = Number(price.airTaxChdCost ?? 0)
  const childBedPrice =
    Number.isFinite(childBase) && childBase > 0
      ? childBase +
        (Number.isFinite(childBaf) ? childBaf : 0) +
        (Number.isFinite(childTax) ? childTax : 0)
      : null

  const infBase = Number(price.infPrice ?? 0)
  const infBaf = Number(price.bafInfCost ?? 0)
  const infTax = Number(price.airTaxInfCost ?? 0)
  const infantPrice =
    Number.isFinite(infBase) && infBase > 0
      ? infBase + (Number.isFinite(infBaf) ? infBaf : 0) + (Number.isFinite(infTax) ? infTax : 0)
      : null

  return {
    departureDate: departureYmd,
    adultPrice,
    childBedPrice: childBedPrice,
    infantPrice,
    supplierDepartureCodeCandidate: `ybtour:${evCd}`,
    localPriceText: `ybtour:evCd=${evCd}`.slice(0, 200),
  }
}

/** URL evCd 1건 — 달력 전체가 아닌 현재 이벤트 행 API 수집. */
export async function collectYbtourApiDepartureInputsForUrl(
  detailUrl: string,
): Promise<{ inputs: DepartureInput[]; evCd: string | null; title: string | null }> {
  const evCd = parseYbtourEvCdFromUrl(detailUrl)
  if (!evCd) return { inputs: [], evCd: null, title: null }

  const referer = detailUrl.trim() || `https://prdt.ybtour.co.kr/product/detailPackage?evCd=${evCd}`
  const [price, display] = await Promise.all([
    fetchYbtourEventPrice(evCd, referer),
    fetchYbtourEventFirstDisplay(evCd, referer),
  ])
  if (!price) return { inputs: [], evCd, title: display?.evNm?.trim() || null }

  const departureYmd = resolveYbtourDepartureYmdForEvCd(evCd, display)
  if (!departureYmd) return { inputs: [], evCd, title: display?.evNm?.trim() || null }

  const input = ybtourEventPriceToDepartureInput(evCd, price, departureYmd)
  return {
    inputs: input ? [input] : [],
    evCd,
    title: display?.evNm?.trim() || null,
  }
}

export type YbtourByGoodsCollectOptions = {
  originCode?: string | null
  /** false면 by-goods 성인가만 (커버리지·교차검증용). 기본 true. */
  enrichEvCdPrice?: boolean
}

/** goodsCd + by-goods 월 API — 180일 다출발 수집 (+ 선택 evCd /price 아동·유아). */
export async function collectYbtourByGoodsApiDepartureInputsForUrl(
  detailUrl: string,
  fromYmd: string,
  toYmd: string,
  options?: YbtourByGoodsCollectOptions,
): Promise<{
  inputs: DepartureInput[]
  goodsCd: string | null
  goodsCdFromUrl: string | null
  dspSid: string | null
  seedEvCd: string | null
  monthKeys: string[]
  rawRowCount: number
  evCdPriceEnriched: boolean
}> {
  const goodsCdFromUrl = parseYbtourGoodsCdFromUrl(detailUrl)
  const goodsCd = resolveYbtourGoodsCdForApi(detailUrl, options?.originCode)
  if (!goodsCd) {
    return {
      inputs: [],
      goodsCd: null,
      goodsCdFromUrl,
      dspSid: null,
      seedEvCd: null,
      monthKeys: [],
      rawRowCount: 0,
      evCdPriceEnriched: false,
    }
  }

  const referer =
    detailUrl.trim() ||
    `https://prdt.ybtour.co.kr/product/detailPackage?goodsCd=${encodeURIComponent(goodsCd)}`
  const seedEvCd = await resolveYbtourSeedEvCd(detailUrl, goodsCd, referer)
  if (!seedEvCd) {
    return {
      inputs: [],
      goodsCd,
      goodsCdFromUrl,
      dspSid: null,
      seedEvCd: null,
      monthKeys: [],
      rawRowCount: 0,
      evCdPriceEnriched: false,
    }
  }

  const display = await fetchYbtourEventFirstDisplay(seedEvCd, referer)
  const dspSid = resolveYbtourByGoodsDspSid(display)
  if (!dspSid) {
    return {
      inputs: [],
      goodsCd,
      goodsCdFromUrl,
      dspSid: null,
      seedEvCd,
      monthKeys: [],
      rawRowCount: 0,
      evCdPriceEnriched: false,
    }
  }

  const monthKeys = ybtourMonthKeysForYmdWindow(fromYmd, toYmd)
  const merged: DepartureInput[] = []
  let rawRowCount = 0

  for (const monthKey of monthKeys) {
    const rows = await fetchYbtourEventByGoodsMonth(goodsCd, dspSid, monthKey, referer)
    rawRowCount += rows.length
    for (const row of rows) {
      const mapped = ybtourByGoodsRowToDepartureInput(row)
      if (mapped) merged.push(mapped)
    }
  }

  let inputs = filterYbtourInputsInYmdWindow(dedupeYbtourInputsByEvCd(merged), fromYmd, toYmd)
  const enrichEvCdPrice = options?.enrichEvCdPrice !== false
  let evCdPriceEnriched = false
  if (enrichEvCdPrice && inputs.length > 0) {
    inputs = await enrichYbtourDepartureInputsWithEvCdPrice(inputs, referer)
    evCdPriceEnriched = true
  }

  return {
    inputs,
    goodsCd,
    goodsCdFromUrl,
    dspSid,
    seedEvCd,
    monthKeys,
    rawRowCount,
    evCdPriceEnriched,
  }
}

export function filterYbtourInputsInYmdWindow(
  inputs: DepartureInput[],
  fromYmd: string,
  toYmd: string,
): DepartureInput[] {
  const lo = fromYmd <= toYmd ? fromYmd : toYmd
  const hi = fromYmd <= toYmd ? toYmd : fromYmd
  return inputs.filter((x) => {
    const d = departureInputToYmd(x.departureDate)
    return d != null && d >= lo && d <= hi && (x.adultPrice ?? 0) > 0
  })
}
