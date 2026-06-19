/**
 * ybtour papi — evCd 중심 가격·출발 메타 (브라우저가 호출하는 공개 JSON).
 *
 * REGRESSION-FREEZE[ybtour-api-departure-collect]: papi.ybtour.co.kr pkg/event — manifest
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
}

export type YbtourEventFirstDisplayBody = {
  evCd?: string
  evNm?: string
  evStartDt?: string
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

export function ybtourEventPriceToDepartureInput(
  evCd: string,
  price: YbtourEventPriceBody,
  departureYmd: string,
): DepartureInput | null {
  const adultBase = Number(price.adtPrice ?? 0)
  const baf = Number(price.bafAdtCost ?? 0)
  const adultPrice = adultBase + (Number.isFinite(baf) ? baf : 0)
  if (!Number.isFinite(adultPrice) || adultPrice <= 0) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(departureYmd)) return null

  const childBase = Number(price.chdPrice ?? 0)
  const childBaf = Number(price.bafChdCost ?? 0)
  const childBedPrice =
    Number.isFinite(childBase) && childBase > 0 ? childBase + (Number.isFinite(childBaf) ? childBaf : 0) : null

  const infBase = Number(price.infPrice ?? 0)
  const infBaf = Number(price.bafInfCost ?? 0)
  const infantPrice =
    Number.isFinite(infBase) && infBase > 0 ? infBase + (Number.isFinite(infBaf) ? infBaf : 0) : null

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

  const departureYmd =
    ybtourYmdFromEvStartDt(display?.evStartDt) ?? parseYbtourDepartureYmdFromEvCd(evCd)
  if (!departureYmd) return { inputs: [], evCd, title: display?.evNm?.trim() || null }

  const input = ybtourEventPriceToDepartureInput(evCd, price, departureYmd)
  return {
    inputs: input ? [input] : [],
    evCd,
    title: display?.evNm?.trim() || null,
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
