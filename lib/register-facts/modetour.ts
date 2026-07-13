/**
 * modetour 등록 사실 수집 — b2c-api 구조화 응답만 사용.
 *
 * REGRESSION-FREEZE[register-facts-foundation]: GetProductDetailInfo·GetScheduleList — manifest
 * REGRESSION-FREEZE[register-facts-fetch-resilience]: GetOtherDepartureDates_lite — manifest
 */
import { parseModetourPackageProductNoFromUrl } from '@/lib/modetour-departures'
import { extractModetourIncludedExcludedFromDetailInfo, extractModetourShoppingFromDetailBundle } from '@/lib/modetour-register-api-detail'
import type { RegisterFactPriceRow, SupplierRegisterFactBundle } from '@/lib/register-facts/types'
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'
import {
  inferModetourRegisterFactProductKind,
  registerFactProductKindNote,
  resolveRegisterFactProductKindFromAdminTravelScope,
} from '@/lib/register-facts/product-kind'

const MODETOUR_API_BASE = process.env.MODETOUR_API_BASE_URL ?? 'https://b2c-api.modetour.com'
const MODETOUR_WEB_API_REQ_HEADER =
  process.env.MODETOUR_WEB_API_REQ_HEADER ??
  '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}'

function modetourHeaders(referer: string, productNo: string): HeadersInit {
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
  const res = await fetch(url, { method: 'GET', headers })
  if (!res.ok) return null
  return (await res.json()) as T
}

import {
  modetourFlightRoutesToFactLegs,
  modetourScheduleItemsToFactDays,
  type ModetourFlightRouteItem,
  type ModetourScheduleItem,
} from '@/lib/register-facts/modetour-register-fact-mappers'

export { modetourFlightRoutesToFactLegs, modetourScheduleItemsToFactDays }

function ymdFromIso(raw: string | null | undefined): string | null {
  const m = String(raw ?? '').match(/^(\d{4}-\d{2}-\d{2})/)
  return m?.[1] ?? null
}

type ModetourOtherDepartureRow = {
  departureDate?: string
  minPrice?: number
  pId?: string
}

/** GetOtherDepartureDates 행 → RegisterFactPriceRow (등록 사실 경량). */
export function modetourOtherDepartureRowsToRegisterFactPriceRows(
  rows: ModetourOtherDepartureRow[],
  productNo: string,
  fromYmd: string,
  toYmd: string,
): RegisterFactPriceRow[] {
  const out: RegisterFactPriceRow[] = []
  for (const r of rows) {
    const departureDate = String(r.departureDate ?? '').trim()
    const adultPrice = Number(r.minPrice ?? 0)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(departureDate) || !Number.isFinite(adultPrice) || adultPrice <= 0) {
      continue
    }
    if (departureDate < fromYmd || departureDate > toYmd) continue
    const pid = String(r.pId ?? '').trim()
    out.push({
      departureDate,
      adultPrice,
      childPrice: null,
      infantPrice: null,
      supplierDepartureCode: pid ? `modetour:${pid}` : `modetour:${productNo}`,
      statusRaw: null,
      seatsStatusRaw: null,
      seatCount: null,
      minPax: null,
      carrierName: null,
    })
  }
  return out
}

/** 등록 사실 — GetOtherDepartureDates만 사용(pId prefetch·baseline match 생략). */
async function fetchModetourRegisterFactPriceRows(
  productNo: string,
  referer: string,
  fromYmd: string,
  toYmd: string,
): Promise<RegisterFactPriceRow[]> {
  try {
    const base = MODETOUR_API_BASE.replace(/\/$/, '')
    const apiUrl = `${base}/Package/GetOtherDepartureDates?productNo=${encodeURIComponent(productNo)}&searchFrom=${encodeURIComponent(fromYmd)}&searchTo=${encodeURIComponent(toYmd)}`
    const res = await fetch(apiUrl, {
      method: 'GET',
      headers: modetourHeaders(referer, productNo),
      signal: AbortSignal.timeout(45_000),
    })
    if (!res.ok) return []
    const json = (await res.json()) as { result?: ModetourOtherDepartureRow[] }
    const rows = Array.isArray(json?.result) ? json.result : []
    return modetourOtherDepartureRowsToRegisterFactPriceRows(rows, productNo, fromYmd, toYmd)
  } catch {
    return []
  }
}

/** register-facts·detail-parity 공용 — GetOtherDepartureDates_lite + detail 단건 폴백 행 수. */
export async function countModetourRegisterFactPriceRows(
  originUrl: string,
  detail?: Record<string, unknown> | null,
): Promise<number> {
  const productNo = parseModetourPackageProductNoFromUrl(originUrl)
  if (!productNo || productNo === '0') return 0
  const referer = originUrl.trim() || `https://www.modetour.com/package/${productNo}`
  const fromYmd = kstTodayYmd()
  const toYmd = addDaysUtcYmd(fromYmd, RULE_A_WINDOW_DAYS)
  const priceRows = await fetchModetourRegisterFactPriceRows(productNo, referer, fromYmd, toYmd)
  if (priceRows.length > 0) return priceRows.length
  const fallbackDate = ymdFromIso(String(detail?.departureDate ?? ''))
  const fallbackAdult = Number(detail?.sellingPriceAdultTotalAmount ?? detail?.sellingPrice ?? 0)
  if (fallbackDate && Number.isFinite(fallbackAdult) && fallbackAdult > 0) return 1
  return 0
}

export async function collectModetourRegisterFacts(
  originUrl: string,
  options?: { originCode?: string | null; adminTravelScope?: string | null },
): Promise<SupplierRegisterFactBundle | null> {
  const productNo = parseModetourPackageProductNoFromUrl(originUrl)
  if (!productNo || productNo === '0') return null

  const referer = originUrl.trim() || `https://www.modetour.com/package/${productNo}`
  const headers = modetourHeaders(referer, productNo)
  const base = MODETOUR_API_BASE.replace(/\/$/, '')

  const [detailJson, scheduleJson, flightJson] = await Promise.all([
    fetchModetourJson<{ result?: Record<string, unknown> }>(
      `${base}/Package/GetProductDetailInfo?productNo=${encodeURIComponent(productNo)}&companyNo=undefined&companyStaffNo=undefined`,
      headers,
    ),
    fetchModetourJson<{ result?: { scheduleItemList?: ModetourScheduleItem[] } }>(
      `${base}/Package/GetScheduleList?productNo=${encodeURIComponent(productNo)}`,
      headers,
    ),
    fetchModetourJson<{ result?: ModetourFlightRouteItem[] }>(
      `${base}/Package/ItineraryDlgFlightRoute?productNo=${encodeURIComponent(productNo)}`,
      headers,
    ),
  ])

  const detail = detailJson?.result ?? {}
  const inclExcl = extractModetourIncludedExcludedFromDetailInfo(detail)
  const shoppingMeta = extractModetourShoppingFromDetailBundle(detail, detail)
  const shoppingPlaces =
    shoppingMeta.noShoppingFlag === true
      ? ['노쇼핑']
      : shoppingMeta.shoppingVisitCount != null && shoppingMeta.shoppingVisitCount > 0
        ? [`쇼핑 ${shoppingMeta.shoppingVisitCount}회`]
        : []
  const scheduleItems = scheduleJson?.result?.scheduleItemList ?? []
  const flights = modetourFlightRoutesToFactLegs(flightJson?.result ?? [])

  const fromYmd = kstTodayYmd()
  const toYmd = addDaysUtcYmd(fromYmd, RULE_A_WINDOW_DAYS)
  const productKind = resolveRegisterFactProductKindFromAdminTravelScope(
    options?.adminTravelScope,
    inferModetourRegisterFactProductKind(detail),
  )

  // REGRESSION-FREEZE[register-facts-fetch-resilience]: GetOtherDepartureDates_lite only — no baseline pId path
  const priceRows = await fetchModetourRegisterFactPriceRows(productNo, referer, fromYmd, toYmd)

  const fallbackDate = ymdFromIso(String(detail.departureDate ?? ''))
  const fallbackAdult = Number(detail.sellingPriceAdultTotalAmount ?? detail.sellingPrice ?? 0)
  const resolvedPriceRows =
    priceRows.length > 0
      ? priceRows
      : fallbackDate && Number.isFinite(fallbackAdult) && fallbackAdult > 0
        ? [
            {
              departureDate: fallbackDate,
              adultPrice: fallbackAdult,
              childPrice: null,
              infantPrice: null,
              supplierDepartureCode: `modetour:${productNo}`,
            },
          ]
        : []

  return {
    supplier: 'modetour',
    fetchedAt: new Date().toISOString(),
    originUrl,
    originCode: options?.originCode?.trim() || null,
    title: String(detail.groupName ?? detail.productName ?? '').trim() || null,
    nights: Number.isFinite(Number(detail.nightCount)) ? Number(detail.nightCount) : null,
    days: Number.isFinite(Number(detail.dayCount)) ? Number(detail.dayCount) : null,
    meetingInfo: null,
    includedBullets: inclExcl.includedItems,
    excludedBullets: inclExcl.excludedItems,
    shoppingPlaces,
    scheduleDays: modetourScheduleItemsToFactDays(scheduleItems),
    flights,
    priceRows: resolvedPriceRows,
    notes: [
      'source=modetour_b2c_api',
      'calendar_source=GetOtherDepartureDates_lite',
      `productNo=${productNo}`,
      `calendar_rows=${resolvedPriceRows.length}`,
      registerFactProductKindNote(productKind),
      'price_collect=lite_only',
    ],
  }
}
