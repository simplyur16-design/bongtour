/**
 * modetour 등록 사실 수집 — b2c-api 구조화 응답만 사용.
 *
 * REGRESSION-FREEZE[register-facts-foundation]: GetProductDetailInfo·GetScheduleList — manifest
 */
import { parseModetourPackageProductNoFromUrl } from '@/lib/modetour-departures'
import type {
  RegisterFactFlightLeg,
  RegisterFactScheduleDay,
  SupplierRegisterFactBundle,
} from '@/lib/register-facts/types'

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

type ModetourScheduleItem = {
  first?: number
  placeHeader?: string[]
  scheduleHotel?: string | null
  ortherActions?: Array<{
    itiDays?: number
    itiServiceName?: string | null
    itiPlaceName?: string | null
    itiSummaryDes?: string | null
  }>
}

function ymdFromIso(raw: string | null | undefined): string | null {
  const m = String(raw ?? '').match(/^(\d{4}-\d{2}-\d{2})/)
  return m?.[1] ?? null
}

export function modetourScheduleItemsToFactDays(items: ModetourScheduleItem[]): RegisterFactScheduleDay[] {
  const byDay = new Map<number, RegisterFactScheduleDay>()
  for (const item of items) {
    const day = Number(item.first ?? 0)
    if (!Number.isFinite(day) || day <= 0) continue
    const row =
      byDay.get(day) ??
      ({
        day,
        places: [],
        hotels: [],
        meals: [],
        transportNote: null,
      } satisfies RegisterFactScheduleDay)

    for (const p of item.placeHeader ?? []) {
      const t = String(p).trim()
      if (t && !row.places.includes(t)) row.places.push(t)
    }
    const hotel = String(item.scheduleHotel ?? '').trim()
    if (hotel && !row.hotels.includes(hotel)) row.hotels.push(hotel)

    for (const act of item.ortherActions ?? []) {
      const svc = String(act.itiServiceName ?? '').trim()
      const place = String(act.itiPlaceName ?? '').trim()
      const summary = String(act.itiSummaryDes ?? '').trim()
      if (/식사|조식|중식|석식/.test(svc) && summary && !row.meals.includes(summary)) {
        row.meals.push(summary)
      } else if (place && !row.places.includes(place)) {
        row.places.push(place)
      }
      if (/이동|항공|국제선|국내선/.test(svc) && summary) {
        row.transportNote = row.transportNote ? `${row.transportNote}; ${summary}` : summary
      }
    }
    byDay.set(day, row)
  }
  return [...byDay.values()].sort((a, b) => a.day - b.day)
}

type ModetourFlightRouteItem = {
  flightTypeName?: string | null
  item?: Array<{
    transportName?: string | null
    departureCityName?: string | null
    departureDate?: string | null
    departureTime?: string | null
    arrivalCityName?: string | null
    arrivalDate?: string | null
    departureFlight?: string | null
  }>
}

export function modetourFlightRoutesToFactLegs(routes: ModetourFlightRouteItem[]): RegisterFactFlightLeg[] {
  const legs: RegisterFactFlightLeg[] = []
  for (const route of routes) {
    const dirRaw = String(route.flightTypeName ?? '').toUpperCase()
    const direction: RegisterFactFlightLeg['direction'] =
      dirRaw.includes('DEPART') ? 'outbound' : dirRaw.includes('RETURN') ? 'inbound' : 'unknown'
    for (const item of route.item ?? []) {
      const depDate = ymdFromIso(item.departureDate)
      const depTime = String(item.departureTime ?? '').trim()
      const arrDate = ymdFromIso(item.arrivalDate)
      legs.push({
        direction,
        carrier: item.transportName?.trim() || null,
        flightNo: item.departureFlight?.trim() || null,
        departureCity: item.departureCityName?.trim() || null,
        departureAt: depDate && depTime ? `${depDate}T${depTime}` : depDate,
        arrivalCity: item.arrivalCityName?.trim() || null,
        arrivalAt: arrDate,
      })
    }
  }
  return legs
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
  const scheduleItems = scheduleJson?.result?.scheduleItemList ?? []
  const flights = modetourFlightRoutesToFactLegs(flightJson?.result ?? [])

  const departureDate = ymdFromIso(String(detail.departureDate ?? ''))
  const adultPrice = Number(detail.sellingPriceAdultTotalAmount ?? detail.sellingPrice ?? 0)

  return {
    supplier: 'modetour',
    fetchedAt: new Date().toISOString(),
    originUrl,
    originCode: options?.originCode?.trim() || null,
    title: String(detail.groupName ?? detail.productName ?? '').trim() || null,
    nights: Number.isFinite(Number(detail.nightCount)) ? Number(detail.nightCount) : null,
    days: Number.isFinite(Number(detail.dayCount)) ? Number(detail.dayCount) : null,
    meetingInfo: null,
    includedBullets: [],
    excludedBullets: [],
    shoppingPlaces: [],
    scheduleDays: modetourScheduleItemsToFactDays(scheduleItems),
    flights,
    priceRows:
      departureDate && Number.isFinite(adultPrice) && adultPrice > 0
        ? [
            {
              departureDate,
              adultPrice,
              childPrice: null,
              infantPrice: null,
              supplierDepartureCode: `modetour:${productNo}`,
            },
          ]
        : [],
    notes: ['source=modetour_b2c_api', `productNo=${productNo}`],
  }
}
