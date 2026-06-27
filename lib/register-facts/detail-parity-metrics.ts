/**
 * register-facts ↔ *-register-api-detail 교차검증 — detail-collect 축 카운트 SSOT.
 * REGRESSION-FREEZE[register-facts-completeness]
 * REGRESSION-FREEZE[register-facts-fetch-resilience]: modetour calendar — GetOtherDepartureDates_lite SSOT
 */
import {
  collectHanatourApiDepartureInputsForMonths,
  parseHanatourPkgCdFromUrl,
} from '@/lib/hanatour-api-departures'
import { buildHanatourKstTargetMonths } from '@/lib/hanatour-departures'
import {
  extractHanatourIncludedExcluded,
  extractHanatourShoppingFromProdInfo,
  fetchHanatourRegisterDetailBundle,
  hanatourItnrToFactDays,
} from '@/lib/hanatour-register-api-detail'
import { parseModetourPackageProductNoFromUrl } from '@/lib/modetour-departures'
import {
  extractModetourIncludedExcludedFromDetailInfo,
  extractModetourShoppingFromDetailBundle,
  fetchModetourRegisterDetailBundle,
} from '@/lib/modetour-register-api-detail'
import {
  countModetourRegisterFactPriceRows,
  modetourFlightRoutesToFactLegs,
  modetourScheduleItemsToFactDays,
} from '@/lib/register-facts/modetour'
import type { CanonicalOverseasSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'
import { departureInputToYmd } from '@/lib/scrape-date-bounds'
import {
  collectLottetourCalendarRange,
  enrichLottetourEvtListCollectionHintsFromDetailPage,
  parseLottetourEvtListCollectionHints,
} from '@/lib/lottetour-departures'
import {
  extractLottetourIncludedExcludedFromBasicAjax,
  extractLottetourMeetingFromScheduleAjax,
  extractLottetourShoppingVisitCountFromCoreInfo,
  fetchLottetourRegisterDetailBundle,
  parseLottetourScheduleDaysFromScheduleAjax,
} from '@/lib/lottetour-register-api-detail'
import {
  extractYbtourIncludedExcluded,
  fetchYbtourRegisterDetailBundle,
  buildYbtourFlightStructuredFromTm,
} from '@/lib/ybtour-register-api-detail'
import { collectYbtourByGoodsApiDepartureInputsForUrl, parseYbtourEvCdFromUrl } from '@/lib/ybtour-api-departures'
import { fetchKyowontourRegisterDetailParityMetrics } from '@/lib/register-facts/detail-parity-metrics-kyowontour'
import { fetchVerygoodRegisterDetailParityMetrics } from '@/lib/register-facts/detail-parity-metrics-verygoodtour'

export type RegisterFactDetailParityMetrics = {
  detailScheduleDays: number
  detailIncludedCount: number
  detailExcludedCount: number
  detailShoppingCount: number
  detailFlightSignal: boolean
  detailPriceRows: number
}

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
  const res = await fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(25_000) })
  if (!res.ok) return null
  return (await res.json()) as T
}

function flightLegHasSignal(legs: Array<{ departureCity?: string | null; arrivalCity?: string | null; flightNo?: string | null; carrier?: string | null }>): boolean {
  return legs.some(
    (f) =>
      Boolean(f.departureCity?.trim()) ||
      Boolean(f.arrivalCity?.trim()) ||
      Boolean(f.flightNo?.trim()) ||
      Boolean(f.carrier?.trim()),
  )
}

async function fetchHanatourDetailParityMetrics(originUrl: string): Promise<RegisterFactDetailParityMetrics | null> {
  const detail = await fetchHanatourRegisterDetailBundle(originUrl)
  if (!detail?.prodInfo) return null
  const { includedItems, excludedItems } = extractHanatourIncludedExcluded(detail.prodInfo)
  const shopping = extractHanatourShoppingFromProdInfo(detail.prodInfo)
  const scheduleDays = hanatourItnrToFactDays(detail.itnr).length

  const pkgCd = parseHanatourPkgCdFromUrl(originUrl)
  if (!pkgCd) return null
  const fromYmd = kstTodayYmd()
  const toYmd = addDaysUtcYmd(fromYmd, RULE_A_WINDOW_DAYS)
  const cal = await collectHanatourApiDepartureInputsForMonths(pkgCd, buildHanatourKstTargetMonths(6))
  const priceRows = cal.inputs.filter((x) => {
    const d = departureInputToYmd(x.departureDate)
    return d != null && d >= fromYmd && d <= toYmd && (x.adultPrice ?? 0) > 0
  }).length
  const detailFlightSignal = cal.inputs.some(
    (i) =>
      Boolean(i.outboundDepartureAirport?.trim()) ||
      Boolean(i.outboundFlightNo?.trim()) ||
      Boolean(i.carrierName?.trim()),
  )

  return {
    detailScheduleDays: scheduleDays,
    detailIncludedCount: includedItems.length,
    detailExcludedCount: excludedItems.length,
    detailShoppingCount: shopping.rows.length,
    detailFlightSignal,
    detailPriceRows: priceRows,
  }
}

async function fetchModetourDetailParityMetrics(originUrl: string): Promise<RegisterFactDetailParityMetrics | null> {
  const productNo = parseModetourPackageProductNoFromUrl(originUrl)
  if (!productNo || productNo === '0') return null

  const referer = originUrl.trim() || `https://www.modetour.com/package/${productNo}`
  const headers = modetourHeaders(referer, productNo)
  const base = MODETOUR_API_BASE.replace(/\/$/, '')

  const [detailBundle, scheduleJson, flightJson] = await Promise.all([
    fetchModetourRegisterDetailBundle(originUrl),
    fetchModetourJson<{ result?: { scheduleItemList?: Parameters<typeof modetourScheduleItemsToFactDays>[0] } }>(
      `${base}/Package/GetScheduleList?productNo=${encodeURIComponent(productNo)}`,
      headers,
    ),
    fetchModetourJson<{ result?: Parameters<typeof modetourFlightRoutesToFactLegs>[0] }>(
      `${base}/Package/ItineraryDlgFlightRoute?productNo=${encodeURIComponent(productNo)}`,
      headers,
    ),
  ])

  const detailPriceRows = await countModetourRegisterFactPriceRows(
    originUrl,
    (detailBundle?.detailInfo ?? null) as Record<string, unknown> | null,
  )

  const scheduleItems = scheduleJson?.result?.scheduleItemList ?? []
  const flightRoutes = flightJson?.result ?? []

  const inclExcl = extractModetourIncludedExcludedFromDetailInfo(detailBundle?.detailInfo)
  const shopping = extractModetourShoppingFromDetailBundle(detailBundle?.detailInfo, detailBundle?.packageInfo)
  const scheduleDays = modetourScheduleItemsToFactDays(scheduleItems).length
  const flights = modetourFlightRoutesToFactLegs(flightRoutes)

  return {
    detailScheduleDays: scheduleDays,
    detailIncludedCount: inclExcl.includedItems.length,
    detailExcludedCount: inclExcl.excludedItems.length,
    detailShoppingCount: shopping.shoppingVisitCount != null ? 1 : 0,
    detailFlightSignal: flightLegHasSignal(flights),
    detailPriceRows,
  }
}

async function fetchYbtourDetailParityMetrics(originUrl: string): Promise<RegisterFactDetailParityMetrics | null> {
  const detailBundle = await fetchYbtourRegisterDetailBundle(originUrl)
  if (!detailBundle) return null
  const evCd = parseYbtourEvCdFromUrl(originUrl)
  if (!evCd) return null
  const referer = originUrl.trim() || `https://prdt.ybtour.co.kr/product/detailPackage?evCd=${evCd}`

  const inclExcl = extractYbtourIncludedExcluded(detailBundle.notice ?? null)
  const shopInfo = String(detailBundle.notice?.shopInfo ?? '').trim()
  const shoppingCount = shopInfo
    ? shopInfo
        .split(/[\n,·]+/)
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 12)
        .length
    : 0

  const scheduleUrl = `${process.env.YBTOUR_PAPI_BASE_URL ?? 'https://papi.ybtour.co.kr'}/pkg/event-schedule/${encodeURIComponent(evCd)}/${encodeURIComponent(evCd.split('-')[0] ?? evCd)}`
  const scheduleRes = await fetch(scheduleUrl, { headers: { accept: 'application/json', referer } })
  let scheduleDays = 0
  if (scheduleRes.ok) {
    const json = (await scheduleRes.json()) as { code?: string; body?: { scheduleDetail?: Array<{ dayNo?: number }> } }
    if (json?.code === '0000') {
      scheduleDays = (json.body?.scheduleDetail ?? []).filter((r) => Number(r.dayNo) > 0).length
    }
  }

  const structured = buildYbtourFlightStructuredFromTm(detailBundle.schedule?.scheduleDetailTm ?? [])
  const fromYmd = kstTodayYmd()
  const toYmd = addDaysUtcYmd(fromYmd, RULE_A_WINDOW_DAYS)
  const cal = await collectYbtourByGoodsApiDepartureInputsForUrl(originUrl, fromYmd, toYmd)
  const priceRows = cal.inputs.filter((x) => (x.adultPrice ?? 0) > 0).length
  const calCarrier = cal.inputs.map((x) => x.carrierName?.trim()).find(Boolean) ?? null

  return {
    detailScheduleDays: scheduleDays,
    detailIncludedCount: inclExcl.includedItems.length,
    detailExcludedCount: inclExcl.excludedItems.length,
    detailShoppingCount: shoppingCount,
    detailFlightSignal: Boolean(
      structured?.outbound?.departureAirport?.trim() ||
        structured?.inbound?.departureAirport?.trim() ||
        structured?.airlineName?.trim() ||
        calCarrier,
    ),
    detailPriceRows: priceRows,
  }
}

async function fetchLottetourDetailParityMetrics(originUrl: string): Promise<RegisterFactDetailParityMetrics | null> {
  const url = originUrl.trim()
  const bundle = await fetchLottetourRegisterDetailBundle(url)
  if (!bundle) return null
  const { includedItems, excludedItems } = extractLottetourIncludedExcludedFromBasicAjax(bundle.basicAjaxHtml)
  const scheduleDays = parseLottetourScheduleDaysFromScheduleAjax(bundle.scheduleAjaxHtml).length
  const shopCount = extractLottetourShoppingVisitCountFromCoreInfo(bundle.basicAjaxHtml)
  const shoppingCount = shopCount != null ? 1 : 0
  const meeting = extractLottetourMeetingFromScheduleAjax(bundle.scheduleAjaxHtml)

  let detailPriceRows = 0
  let hints = parseLottetourEvtListCollectionHints({ rawMeta: null, originUrl: url })
  if (!hints.godId || !hints.menuNos) {
    hints = await enrichLottetourEvtListCollectionHintsFromDetailPage(hints, url)
  }
  if (hints.godId && hints.menuNos) {
    const cal = await collectLottetourCalendarRange(
      { godId: hints.godId, menuNos: hints.menuNos },
      { monthCount: 6, disableE2EFallback: true, logLabel: 'detail-parity-lottetour' },
    )
    const evtPrefix = bundle.evtCd?.slice(0, 5) ?? ''
    const filtered = cal.rows.filter((r) => r.adultPrice > 0 && r.departDate)
    const scoped =
      evtPrefix.length >= 4 ? filtered.filter((r) => r.evtCd.startsWith(evtPrefix.slice(0, 4))) : filtered
    const fromYmd = kstTodayYmd()
    const toYmd = addDaysUtcYmd(fromYmd, RULE_A_WINDOW_DAYS)
    detailPriceRows = (scoped.length > 0 ? scoped : filtered).filter(
      (r) => r.departDate >= fromYmd && r.departDate <= toYmd,
    ).length
  } else if (bundle.evtListRow && bundle.evtListRow.adultPrice > 0 && bundle.evtListRow.departDate) {
    detailPriceRows = 1
  }

  return {
    detailScheduleDays: scheduleDays,
    detailIncludedCount: includedItems.length,
    detailExcludedCount: excludedItems.length,
    detailShoppingCount: shoppingCount,
    detailFlightSignal: Boolean(meeting.meetingPlaceRaw?.trim()),
    detailPriceRows,
  }
}

export async function fetchRegisterFactDetailParityMetrics(
  supplier: CanonicalOverseasSupplierKey,
  originUrl: string,
): Promise<RegisterFactDetailParityMetrics | null> {
  switch (supplier) {
    case 'hanatour':
      return fetchHanatourDetailParityMetrics(originUrl)
    case 'modetour':
      return fetchModetourDetailParityMetrics(originUrl)
    case 'ybtour':
      return fetchYbtourDetailParityMetrics(originUrl)
    case 'lottetour':
      return fetchLottetourDetailParityMetrics(originUrl)
    case 'kyowontour':
      return fetchKyowontourRegisterDetailParityMetrics(originUrl)
    case 'verygoodtour':
      return fetchVerygoodRegisterDetailParityMetrics(originUrl)
    default:
      return null
  }
}
