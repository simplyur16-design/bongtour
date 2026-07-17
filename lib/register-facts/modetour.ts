/**
 * modetour 등록 사실 수집 — b2c-api 구조화 응답만 사용.
 *
 * REGRESSION-FREEZE[register-facts-foundation]: GetProductDetailInfo·GetScheduleList — manifest
 * REGRESSION-FREEZE[register-facts-foundation]: listingPriceSlots — SD1·과거 detail 미리보기 3슬롯 — manifest
 * REGRESSION-FREEZE[register-facts-fetch-resilience]: GetOtherDepartureDates_lite — manifest
 * REGRESSION-FREEZE[register-facts-fetch-resilience]: SD1 시 productCode2 origin-code resolve 달력 — manifest
 */
import { parseModetourPackageProductNoFromUrl } from '@/lib/modetour-departures'
import { resolveModetourDetailByOriginCode } from '@/lib/modetour-origin-code-resolve'
import { modetourB2cBodyIndicatesSd1 } from '@/lib/modetour-sd1-policy'
import { extractModetourIncludedExcludedFromDetailInfo, extractModetourShoppingFromDetailBundle } from '@/lib/modetour-register-api-detail'
import type {
  RegisterFactPriceRow,
  RegisterFactListingPriceSlots,
  SupplierRegisterFactBundle,
} from '@/lib/register-facts/types'
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

/** 숫자 단체번호가 아닌 상품코드(예: PGP416LJM5 · productCode2). */
export function isModetourAlphaOriginCode(code: string | null | undefined): boolean {
  const c = String(code ?? '').trim()
  if (c.length < 6 || /^\d+$/.test(c)) return false
  return /[A-Za-z]/.test(c)
}

/** detail.productCode2 우선 — productCode만으로는 잘린 코드(AHP301)라 resolve 실패. */
export function pickModetourRegisterOriginCode(
  optionsOriginCode: string | null | undefined,
  detail?: Record<string, unknown> | null,
): string | null {
  const fromOpt = String(optionsOriginCode ?? '').trim()
  if (isModetourAlphaOriginCode(fromOpt)) return fromOpt
  const code2 = String(detail?.productCode2 ?? '').trim()
  if (isModetourAlphaOriginCode(code2)) return code2
  return null
}

type ModetourOtherDepartureRow = {
  departureDate?: string
  minPrice?: number
  pId?: string
}

/** detail 3슬롯 — KidN/Toddler 필드가 SSOT (Child/Infant 별칭은 하위 호환). */
// REGRESSION-FREEZE[register-facts-foundation]: listingPriceSlots KidN/Toddler — manifest
export function modetourDetailListingThreeSlotPrices(detail: Record<string, unknown> | null | undefined): {
  departureDate: string | null
  adultPrice: number | null
  childPrice: number | null
  infantPrice: number | null
} {
  if (!detail) {
    return { departureDate: null, adultPrice: null, childPrice: null, infantPrice: null }
  }
  const departureDate = ymdFromIso(String(detail.departureDate ?? ''))
  const adult = Number(detail.sellingPriceAdultTotalAmount ?? detail.sellingPrice ?? 0)
  const child = Number(
    detail.sellingPriceKidNTotalAmount ??
      detail.sellingPriceKidN ??
      detail.sellingPriceKidETotalAmount ??
      detail.sellingPriceKidE ??
      detail.sellingPriceChildTotalAmount ??
      detail.sellingPriceChild ??
      detail.childPrice ??
      0,
  )
  const infant = Number(
    detail.sellingPriceToddlerTotalAmount ??
      detail.sellingPriceToddler ??
      detail.sellingPriceInfantTotalAmount ??
      detail.sellingPriceInfant ??
      detail.infantPrice ??
      0,
  )
  return {
    departureDate,
    adultPrice: Number.isFinite(adult) && adult > 0 ? Math.trunc(adult) : null,
    childPrice: Number.isFinite(child) && child > 0 ? Math.trunc(child) : null,
    infantPrice: Number.isFinite(infant) && infant > 0 ? Math.trunc(infant) : null,
  }
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
): Promise<{ rows: RegisterFactPriceRow[]; sd1: boolean }> {
  try {
    const base = MODETOUR_API_BASE.replace(/\/$/, '')
    const apiUrl = `${base}/Package/GetOtherDepartureDates?productNo=${encodeURIComponent(productNo)}&searchFrom=${encodeURIComponent(fromYmd)}&searchTo=${encodeURIComponent(toYmd)}`
    const res = await fetch(apiUrl, {
      method: 'GET',
      headers: modetourHeaders(referer, productNo),
      signal: AbortSignal.timeout(45_000),
    })
    const text = await res.text()
    let json: { result?: ModetourOtherDepartureRow[]; errorMessages?: unknown } = {}
    try {
      json = JSON.parse(text) as { result?: ModetourOtherDepartureRow[]; errorMessages?: unknown }
    } catch {
      return { rows: [], sd1: false }
    }
    // REGRESSION-FREEZE[register-facts-fetch-resilience]: SD1 달력 응답 표기 — manifest
    if (modetourB2cBodyIndicatesSd1(json, text)) {
      return { rows: [], sd1: true }
    }
    if (!res.ok) return { rows: [], sd1: false }
    const rows = Array.isArray(json?.result) ? json.result : []
    return {
      rows: modetourOtherDepartureRowsToRegisterFactPriceRows(rows, productNo, fromYmd, toYmd),
      sd1: false,
    }
  } catch {
    return { rows: [], sd1: false }
  }
}

/**
 * URL 단체번호 달력이 SD1·0건이면 productCode2(상품코드)로 현행 productNo resolve 후 재조회.
 * REGRESSION-FREEZE[register-facts-fetch-resilience]: SD1 시 productCode2 origin-code resolve 달력 — manifest
 */
async function fetchModetourRegisterFactPriceRowsWithOriginResolve(args: {
  productNo: string
  referer: string
  fromYmd: string
  toYmd: string
  originCodeHint?: string | null
  detail?: Record<string, unknown> | null
}): Promise<{ priceRows: RegisterFactPriceRow[]; calendarProductNo: string; calendarNote: string }> {
  const directHit = await fetchModetourRegisterFactPriceRows(
    args.productNo,
    args.referer,
    args.fromYmd,
    args.toYmd,
  )
  if (directHit.rows.length > 0) {
    return {
      priceRows: directHit.rows,
      calendarProductNo: args.productNo,
      calendarNote: 'calendar_source=GetOtherDepartureDates_lite',
    }
  }

  const originCode = pickModetourRegisterOriginCode(args.originCodeHint, args.detail)
  if (!originCode) {
    return {
      priceRows: [],
      calendarProductNo: args.productNo,
      calendarNote: directHit.sd1
        ? 'calendar_source=GetOtherDepartureDates_lite;calendar_sd1;calendar_empty_no_origin_code'
        : 'calendar_source=GetOtherDepartureDates_lite;calendar_empty_no_origin_code',
    }
  }

  const resolved = await resolveModetourDetailByOriginCode(originCode, {
    storedOriginUrl: args.referer,
  })
  const resolvedNo = resolved.productNo?.trim() || null
  if (!resolvedNo || resolvedNo === '0' || resolvedNo === args.productNo) {
    return {
      priceRows: [],
      calendarProductNo: args.productNo,
      calendarNote: `calendar_source=GetOtherDepartureDates_lite;origin_code=${originCode};resolve=${resolved.source};${directHit.sd1 ? 'calendar_sd1;' : ''}calendar_empty`,
    }
  }

  const resolvedReferer =
    resolved.detailUrl?.trim() || `https://www.modetour.com/package/${resolvedNo}`
  const viaResolve = await fetchModetourRegisterFactPriceRows(
    resolvedNo,
    resolvedReferer,
    args.fromYmd,
    args.toYmd,
  )
  const sd1Tag = directHit.sd1 || viaResolve.sd1 ? 'calendar_sd1;' : ''
  return {
    priceRows: viaResolve.rows,
    calendarProductNo: resolvedNo,
    calendarNote:
      viaResolve.rows.length > 0
        ? `calendar_source=GetOtherDepartureDates_lite;origin_code_resolve=${originCode}->${resolvedNo}`
        : `calendar_source=GetOtherDepartureDates_lite;origin_code_resolve=${originCode}->${resolvedNo};${sd1Tag}calendar_empty`,
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
  const { priceRows, calendarProductNo } = await fetchModetourRegisterFactPriceRowsWithOriginResolve({
    productNo,
    referer,
    fromYmd,
    toYmd,
    detail,
  })
  if (priceRows.length > 0) return priceRows.length

  let detailForFallback: Record<string, unknown> | null | undefined = detail
  if (calendarProductNo && calendarProductNo !== productNo) {
    try {
      const base = MODETOUR_API_BASE.replace(/\/$/, '')
      const resolvedDetailJson = await fetchModetourJson<{ result?: Record<string, unknown> }>(
        `${base}/Package/GetProductDetailInfo?productNo=${encodeURIComponent(calendarProductNo)}&companyNo=undefined&companyStaffNo=undefined`,
        modetourHeaders(
          `https://www.modetour.com/package/${calendarProductNo}`,
          calendarProductNo,
        ),
      )
      if (resolvedDetailJson?.result) detailForFallback = resolvedDetailJson.result
    } catch {
      /* keep URL detail */
    }
  }

  const slots = modetourDetailListingThreeSlotPrices(detailForFallback)
  // REGRESSION-FREEZE[register-facts-fetch-resilience]: 과거 detail 폴백 카운트 제외 — manifest
  if (
    slots.departureDate &&
    slots.departureDate >= fromYmd &&
    slots.departureDate <= toYmd &&
    slots.adultPrice != null &&
    slots.adultPrice > 0
  ) {
    return 1
  }
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
  // REGRESSION-FREEZE[register-facts-fetch-resilience]: SD1 시 productCode2 origin-code resolve 달력 — manifest
  const { priceRows, calendarProductNo, calendarNote } =
    await fetchModetourRegisterFactPriceRowsWithOriginResolve({
      productNo,
      referer,
      fromYmd,
      toYmd,
      originCodeHint: options?.originCode,
      detail,
    })

  // SD1·달력 0건이면 origin resolve된 현행 단체번호 detail로 단건 폴백(URL 과거 앵커만 보지 않음)
  // REGRESSION-FREEZE[register-facts-fetch-resilience]: SD1 시 resolve detail 단건 폴백 — manifest
  let detailForPriceFallback: Record<string, unknown> = detail
  if (priceRows.length === 0 && calendarProductNo && calendarProductNo !== productNo) {
    try {
      const resolvedDetailJson = await fetchModetourJson<{ result?: Record<string, unknown> }>(
        `${base}/Package/GetProductDetailInfo?productNo=${encodeURIComponent(calendarProductNo)}&companyNo=undefined&companyStaffNo=undefined`,
        modetourHeaders(
          `https://www.modetour.com/package/${calendarProductNo}`,
          calendarProductNo,
        ),
      )
      if (resolvedDetailJson?.result && typeof resolvedDetailJson.result === 'object') {
        detailForPriceFallback = resolvedDetailJson.result
      }
    } catch {
      /* URL detail 유지 */
    }
  }

  const fallbackSlots = modetourDetailListingThreeSlotPrices(detailForPriceFallback)
  const fallbackDate = fallbackSlots.departureDate
  const fallbackAdult = fallbackSlots.adultPrice
  // REGRESSION-FREEZE[register-facts-fetch-resilience]: SD1 시 과거 detail 출발 폴백 금지 — manifest
  // REGRESSION-FREEZE[register-facts-foundation]: lite 달력 성인가만일 때 detail KidN/Toddler 보강 — manifest
  const resolvedPriceRows =
    priceRows.length > 0
      ? priceRows.map((row) => ({
          ...row,
          childPrice: row.childPrice ?? fallbackSlots.childPrice,
          infantPrice: row.infantPrice ?? fallbackSlots.infantPrice,
        }))
      : fallbackDate &&
          fallbackDate >= fromYmd &&
          fallbackDate <= toYmd &&
          fallbackAdult != null &&
          fallbackAdult > 0
        ? [
            {
              departureDate: fallbackDate,
              adultPrice: fallbackAdult,
              childPrice: fallbackSlots.childPrice,
              infantPrice: fallbackSlots.infantPrice,
              supplierDepartureCode: `modetour:${calendarProductNo || productNo}`,
            },
          ]
        : []

  const resolvedOriginCode = pickModetourRegisterOriginCode(options?.originCode, detail)
  const urlDetailPast = ymdFromIso(String(detail.departureDate ?? ''))
  const pastDetailNote =
    resolvedPriceRows.length === 0 && urlDetailPast && urlDetailPast < fromYmd
      ? `detail_depart_past=${urlDetailPast}`
      : null

  // REGRESSION-FREEZE[register-facts-foundation]: listingPriceSlots — SD1·과거 detail 미리보기 3슬롯 — manifest
  let listingPriceSlots: RegisterFactListingPriceSlots | null = null
  if (resolvedPriceRows.length === 0 && fallbackAdult != null && fallbackAdult > 0) {
    listingPriceSlots = {
      adultPrice: fallbackAdult,
      childPrice: fallbackSlots.childPrice,
      infantPrice: fallbackSlots.infantPrice,
      sourceDepartureDate: fallbackDate,
      unavailableReason:
        calendarNote.includes('calendar_sd1')
          ? 'sd1'
          : fallbackDate && fallbackDate < fromYmd
            ? 'past_depart'
            : 'calendar_empty',
    }
  }

  return {
    supplier: 'modetour',
    fetchedAt: new Date().toISOString(),
    originUrl,
    originCode: resolvedOriginCode || options?.originCode?.trim() || null,
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
    listingPriceSlots,
    notes: [
      'source=modetour_b2c_api',
      calendarNote,
      `productNo=${productNo}`,
      `calendar_productNo=${calendarProductNo}`,
      `calendar_rows=${resolvedPriceRows.length}`,
      ...(pastDetailNote ? [pastDetailNote] : []),
      ...(listingPriceSlots
        ? [
            `listing_slots_adult=${listingPriceSlots.adultPrice ?? ''};child=${listingPriceSlots.childPrice ?? ''};infant=${listingPriceSlots.infantPrice ?? ''}`,
          ]
        : []),
      registerFactProductKindNote(productKind),
      'price_collect=lite_only',
    ],
  }
}
