/**
 * modetour 등록 사실 수집 — b2c-api 구조화 응답만 사용.
 *
 * REGRESSION-FREEZE[register-facts-foundation]: GetProductDetailInfo·GetScheduleList — manifest
 */
import { parseModetourPackageProductNoFromUrl, collectModetourDepartureInputsForDateRange } from '@/lib/modetour-departures'
import { extractModetourIncludedExcludedFromDetailInfo, extractModetourShoppingFromDetailBundle } from '@/lib/modetour-register-api-detail'
import { registerDepartureLikeToFactPriceRow } from '@/lib/register-fact-price-row'
import type { SupplierRegisterFactBundle } from '@/lib/register-facts/types'
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'
import {
  inferModetourRegisterFactProductKind,
  registerFactProductKindNote,
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

export async function collectModetourRegisterFacts(
  originUrl: string,
  options?: { originCode?: string | null },
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
  const calInputs = await collectModetourDepartureInputsForDateRange(referer, fromYmd, toYmd, {
    skipBaselineMatch: true,
  })
  const priceRows = calInputs
    .map((dep) =>
      registerDepartureLikeToFactPriceRow({
        ...dep,
        supplierDepartureCode: dep.supplierDepartureCodeCandidate ?? `modetour:${productNo}`,
      }),
    )
    .filter((row): row is NonNullable<typeof row> => row != null)

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
      `productNo=${productNo}`,
      `calendar_rows=${resolvedPriceRows.length}`,
      registerFactProductKindNote(inferModetourRegisterFactProductKind(detail)),
    ],
  }
}
