/**
 * modetour 가격 수집 — B2C API 우선, SD1·0건 시 E2E(6개월) 폴백.
 *
 * REGRESSION-FREEZE[modetour-sweep-e2e-recheck]: API→E2E 폴백·stale 미래출발 검증 — manifest
 */
import {
  mapScrapedRowsToInputs,
  scrapeLiveCalendar,
} from '@/lib/admin-departure-rescrape'
import { parseModetourPackageProductNoFromUrl } from '@/lib/modetour-departures'
import {
  isModetourSd1NotFoundError,
  ModetourB2cApiError,
} from '@/lib/modetour-sd1-policy'
import { departureInputToYmd, filterDepartureInputsOnOrAfterCalendarToday } from '@/lib/scrape-date-bounds'
import type { DepartureInput } from '@/lib/upsert-product-departures-modetour'

const MODETOUR_API_BASE = process.env.MODETOUR_API_BASE_URL ?? 'https://b2c-api.modetour.com'
const MODETOUR_WEB_API_REQ_HEADER =
  process.env.MODETOUR_WEB_API_REQ_HEADER ??
  '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}'

type ModetourDepartureRow = {
  pId?: number
  minPrice?: number
  departureDate?: string
}

type ModetourDepartureResponse = {
  result?: ModetourDepartureRow[]
  errorMessages?: Array<{ errorCode?: string; errorMessage?: string } | string> | null
  isOK?: boolean
}

export type ModetourPriceCollectSource = 'api' | 'e2e'

export type ModetourPriceCollectResult = {
  inputs: DepartureInput[]
  sourceDates: string[]
  source: ModetourPriceCollectSource | null
  apiFailedSd1: boolean
  e2eAttempted: boolean
  e2eError: string | null
}

function modetourApiHeaders(referer: string, productNo: string): HeadersInit {
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

async function fetchModetourJson<T>(url: string, headers: HeadersInit): Promise<T> {
  const res = await fetch(url, { method: 'GET', headers })
  if (!res.ok) {
    const bodyText = await res.text()
    let bodyJson: unknown = null
    try {
      bodyJson = JSON.parse(bodyText) as unknown
    } catch {
      bodyJson = null
    }
    throw new ModetourB2cApiError(res.status, url, bodyText, bodyJson)
  }
  return (await res.json()) as T
}

function filterInputsInYmdWindow(
  inputs: DepartureInput[],
  fromYmd: string,
  toYmd: string,
): DepartureInput[] {
  const lo = fromYmd <= toYmd ? fromYmd : toYmd
  const hi = fromYmd <= toYmd ? toYmd : fromYmd
  return inputs.filter((x) => {
    const dk = departureInputToYmd(x.departureDate)
    return dk != null && dk >= lo && dk <= hi
  })
}

function pricedInputsInWindow(
  inputs: DepartureInput[],
  fromYmd: string,
  toYmd: string,
): DepartureInput[] {
  return filterInputsInYmdWindow(inputs, fromYmd, toYmd).filter((x) => {
    const p = x.adultPrice
    return p != null && Number.isFinite(p) && p > 0
  })
}

/** GetOtherDepartureDates 1회 — sweep·배치 공통 경량 API. */
export async function collectModetourApiDepartureInputs(
  originUrl: string | null | undefined,
  fromYmd: string,
  toYmd: string,
): Promise<{ inputs: DepartureInput[]; sourceDates: string[] }> {
  const productNo = parseModetourPackageProductNoFromUrl(originUrl)
  if (!productNo) return { inputs: [], sourceDates: [] }

  const lo = fromYmd <= toYmd ? fromYmd : toYmd
  const hi = fromYmd <= toYmd ? toYmd : fromYmd
  const referer = originUrl?.trim() || `https://www.modetour.com/package/${productNo}`
  const headers = modetourApiHeaders(referer, productNo)
  const apiUrl = `${MODETOUR_API_BASE.replace(/\/$/, '')}/Package/GetOtherDepartureDates?productNo=${encodeURIComponent(productNo)}&searchFrom=${lo}&searchTo=${hi}`

  const json = await fetchModetourJson<ModetourDepartureResponse>(apiUrl, headers)
  const rows = Array.isArray(json?.result) ? json.result : []

  const sourceDates: string[] = []
  const inputs: DepartureInput[] = []
  for (const r of rows) {
    const departureDate = String(r.departureDate ?? '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(departureDate)) continue
    if (departureDate >= lo && departureDate <= hi) {
      sourceDates.push(departureDate)
    }

    const price = Number(r.minPrice ?? 0)
    if (!Number.isFinite(price) || price <= 0) continue

    const pid = String(r.pId ?? '').trim()
    inputs.push({
      departureDate,
      adultPrice: price,
      supplierDepartureCodeCandidate: pid ? `modetour:${pid}` : null,
      localPriceText: pid ? `modetour:pId=${pid}`.slice(0, 200) : null,
    })
  }
  return { inputs, sourceDates }
}

async function collectModetourE2eDepartureInputs(
  originUrl: string | null | undefined,
  fromYmd: string,
  toYmd: string,
): Promise<{ inputs: DepartureInput[]; sourceDates: string[]; error: string | null }> {
  const detailUrl = originUrl?.trim()
  if (!detailUrl) {
    return { inputs: [], sourceDates: [], error: 'missing originUrl' }
  }

  const lo = fromYmd <= toYmd ? fromYmd : toYmd
  const hi = fromYmd <= toYmd ? toYmd : fromYmd

  try {
    const cal = await scrapeLiveCalendar(detailUrl, 'modetour')
    const statusByDate = new Map<
      string,
      { statusRaw: string | null; seatsStatusRaw: string | null }
    >()
    const mapped = filterDepartureInputsOnOrAfterCalendarToday(
      mapScrapedRowsToInputs(cal.rows, statusByDate),
    )
    const inputs = pricedInputsInWindow(mapped, lo, hi)

    const sourceDates: string[] = []
    for (const r of cal.rows) {
      const date = String(r.date ?? '').trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
      if (date >= lo && date <= hi) sourceDates.push(date)
    }

    return { inputs, sourceDates: [...new Set(sourceDates)], error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { inputs: [], sourceDates: [], error: msg.slice(0, 400) }
  }
}

/**
 * API 우선 수집. SD1 또는 지평 내 성인가 출발 0건이면 E2E(6개월 스크래퍼)로 검증.
 * API 비-SD1 오류는 그대로 throw — sweep이 skip 처리.
 */
export async function collectModetourPriceInputsWithE2eFallback(
  originUrl: string | null | undefined,
  fromYmd: string,
  toYmd: string,
): Promise<ModetourPriceCollectResult> {
  let apiFailedSd1 = false

  try {
    const api = await collectModetourApiDepartureInputs(originUrl, fromYmd, toYmd)
    const priced = pricedInputsInWindow(api.inputs, fromYmd, toYmd)
    if (priced.length > 0) {
      return {
        inputs: priced,
        sourceDates: [...new Set(api.sourceDates)],
        source: 'api',
        apiFailedSd1: false,
        e2eAttempted: false,
        e2eError: null,
      }
    }
  } catch (err) {
    if (isModetourSd1NotFoundError(err)) {
      apiFailedSd1 = true
    } else {
      throw err
    }
  }

  const e2e = await collectModetourE2eDepartureInputs(originUrl, fromYmd, toYmd)
  if (e2e.inputs.length > 0) {
    return {
      inputs: e2e.inputs,
      sourceDates: e2e.sourceDates,
      source: 'e2e',
      apiFailedSd1,
      e2eAttempted: true,
      e2eError: null,
    }
  }

  return {
    inputs: [],
    sourceDates: [],
    source: null,
    apiFailedSd1,
    e2eAttempted: true,
    e2eError: e2e.error,
  }
}
