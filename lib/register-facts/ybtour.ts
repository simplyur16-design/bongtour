/**
 * ybtour 등록 사실 수집 — papi evCd + event-schedule.
 *
 * REGRESSION-FREEZE[register-facts-foundation]: papi event/schedule — manifest
 * REGRESSION-FREEZE[register-facts-fetch-resilience]: scheduleDetailTm → places(route) — manifest
 */
import {
  collectYbtourByGoodsApiDepartureInputsForUrl,
  resolveYbtourEvCdForRegisterUrl,
} from '@/lib/ybtour-api-departures'
import {
  extractYbtourIncludedExcluded,
  fetchYbtourRegisterDetailBundle,
  buildYbtourFlightStructuredFromTm,
  ybtourScheduleBundleToRegisterSchedule,
  type YbtourScheduleDetailRow,
} from '@/lib/ybtour-register-api-detail'
import { registerDepartureLikeToFactPriceRow } from '@/lib/register-fact-price-row'
import type { RegisterFactScheduleDay, RegisterFactFlightLeg, SupplierRegisterFactBundle } from '@/lib/register-facts/types'
import type { RegisterScheduleDay } from '@/lib/register-llm-schema-ybtour'
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'
import {
  inferRegisterFactProductKindFromOriginUrl,
  registerFactProductKindNote,
} from '@/lib/register-facts/product-kind'
import { departureInputToYmd } from '@/lib/scrape-date-bounds'

function thinFactDaysFromScheduleDetail(rows: YbtourScheduleDetailRow[]): RegisterFactScheduleDay[] {
  const out: RegisterFactScheduleDay[] = []
  for (const row of rows) {
    const day = Number(row.dayNo ?? 0)
    if (!Number.isFinite(day) || day <= 0) continue
    const meals = [row.foodB, row.foodL, row.foodD].map((x) => String(x ?? '').trim()).filter(Boolean)
    const hotel = String(row.accommNm ?? '').trim()
    out.push({
      day,
      places: [],
      hotels: hotel ? [hotel] : [],
      meals,
      transportNote: null,
    })
  }
  return out.sort((a, b) => a.day - b.day)
}

/** RegisterScheduleDay → fact day (routeText 세그먼트 = places) */
export function ybtourRegisterScheduleToFactDays(days: RegisterScheduleDay[]): RegisterFactScheduleDay[] {
  return days.map((d) => {
    const places = d.routeText
      ? d.routeText
          .split(/\s*-\s*/)
          .map((x) => x.trim())
          .filter(Boolean)
      : d.title?.trim() && d.title.trim() !== `${d.day}일차`
        ? [d.title.trim()]
        : []
    const meals = [d.breakfastText, d.lunchText, d.dinnerText].map((x) => String(x ?? '').trim()).filter(Boolean)
    return {
      day: d.day,
      places,
      hotels: d.hotelText?.trim() ? [d.hotelText.trim()] : [],
      meals,
      transportNote: null,
    }
  })
}

/**
 * scheduleDetail(trvInfo)만으로는 places가 비는 경우가 많음.
 * 이미 받은 detailBundle의 scheduleDetailTm route를 우선 병합한다.
 */
export function preferYbtourFactScheduleDaysWithTmRoute(
  thinFromScheduleDetail: RegisterFactScheduleDay[],
  detailSchedule: {
    scheduleDetail?: Parameters<typeof ybtourScheduleBundleToRegisterSchedule>[0]
    scheduleDetailTm?: Parameters<typeof ybtourScheduleBundleToRegisterSchedule>[1]
  } | null | undefined,
): RegisterFactScheduleDay[] {
  const detail = detailSchedule?.scheduleDetail ?? []
  const tm = detailSchedule?.scheduleDetailTm ?? []
  if (detail.length + tm.length === 0) return thinFromScheduleDetail

  const rich = ybtourRegisterScheduleToFactDays(ybtourScheduleBundleToRegisterSchedule(detail, tm))
  const thinPlaceCount = thinFromScheduleDetail.reduce((n, d) => n + d.places.length, 0)
  const richPlaceCount = rich.reduce((n, d) => n + d.places.length, 0)
  if (richPlaceCount <= thinPlaceCount) return thinFromScheduleDetail

  const thinByDay = new Map(thinFromScheduleDetail.map((d) => [d.day, d]))
  return rich.map((d) => {
    const t = thinByDay.get(d.day)
    return {
      ...d,
      meals: d.meals.length > 0 ? d.meals : (t?.meals ?? []),
      hotels: d.hotels.length > 0 ? d.hotels : (t?.hotels ?? []),
    }
  })
}

function ybtourFlightStructuredToFactLegs(
  scheduleDetailTm: Parameters<typeof buildYbtourFlightStructuredFromTm>[0],
): RegisterFactFlightLeg[] {
  const structured = buildYbtourFlightStructuredFromTm(scheduleDetailTm)
  if (!structured) return []
  const legs: RegisterFactFlightLeg[] = []
  if (structured.outbound) {
    legs.push({
      direction: 'outbound',
      carrier: structured.airlineName ?? null,
      flightNo: structured.outbound.flightNo ?? null,
      departureCity: structured.outbound.departureAirport ?? null,
      departureAt: structured.outbound.departureDate ?? null,
      arrivalCity: structured.outbound.arrivalAirport ?? null,
      arrivalAt: structured.outbound.arrivalDate ?? null,
    })
  }
  if (structured.inbound) {
    legs.push({
      direction: 'inbound',
      carrier: structured.airlineName ?? null,
      flightNo: structured.inbound.flightNo ?? null,
      departureCity: structured.inbound.departureAirport ?? null,
      departureAt: structured.inbound.departureDate ?? null,
      arrivalCity: structured.inbound.arrivalAirport ?? null,
      arrivalAt: structured.inbound.arrivalDate ?? null,
    })
  }
  return legs
}

export async function collectYbtourRegisterFacts(originUrl: string): Promise<SupplierRegisterFactBundle | null> {
  const resolved = await resolveYbtourEvCdForRegisterUrl(originUrl)
  if (!resolved) return null

  const { evCd, goodsCd, referer } = resolved
  const fromYmd = kstTodayYmd()
  const toYmd = addDaysUtcYmd(fromYmd, RULE_A_WINDOW_DAYS)
  // REGRESSION-FREEZE[register-facts-fetch-resilience]: ybtour facts lite — enrichEvCdPrice false + detail notice/schedule only — manifest
  // by-goods 성인가만(출발일마다 /price N회 금지). schedule·TM은 detailBundle 1회로.
  const [apiHit, detailBundle] = await Promise.all([
    collectYbtourByGoodsApiDepartureInputsForUrl(originUrl, fromYmd, toYmd, {
      enrichEvCdPrice: false,
    }),
    fetchYbtourRegisterDetailBundle(originUrl, { includeTourDetail: false }),
  ])

  const thinScheduleDays = thinFactDaysFromScheduleDetail(detailBundle?.schedule?.scheduleDetail ?? [])

  const inclExcl = extractYbtourIncludedExcluded(detailBundle?.notice ?? null)
  const shopInfo = String(detailBundle?.notice?.shopInfo ?? '').trim()
  const shoppingPlaces = shopInfo
    ? shopInfo
        .split(/[\n,·]+/)
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 12)
    : []

  const priceRows = apiHit.inputs
    .map((dep) =>
      registerDepartureLikeToFactPriceRow({
        ...dep,
        supplierDepartureCode: dep.supplierDepartureCodeCandidate ?? null,
      }),
    )
    .filter((row): row is NonNullable<typeof row> => row != null)

  const flightsFromNotice = ybtourFlightStructuredToFactLegs(detailBundle?.schedule?.scheduleDetailTm ?? [])
  const firstCalCarrier = apiHit.inputs.map((x) => x.carrierName?.trim()).find(Boolean) ?? null
  const flights =
    flightsFromNotice.length > 0
      ? flightsFromNotice
      : firstCalCarrier
        ? [
            {
              direction: 'outbound' as const,
              carrier: firstCalCarrier,
              flightNo: null,
              departureCity: null,
              departureAt: apiHit.inputs[0] ? departureInputToYmd(apiHit.inputs[0].departureDate) : null,
              arrivalCity: null,
              arrivalAt: null,
            },
          ]
        : []

  // REGRESSION-FREEZE[register-facts-fetch-resilience]: scheduleDetailTm → places(route) — manifest
  const scheduleDaysWithRoute = preferYbtourFactScheduleDaysWithTmRoute(thinScheduleDays, detailBundle?.schedule)
  const usedTmRoute =
    scheduleDaysWithRoute.reduce((n, d) => n + d.places.length, 0) >
    thinScheduleDays.reduce((n, d) => n + d.places.length, 0)

  return {
    supplier: 'ybtour',
    fetchedAt: new Date().toISOString(),
    originUrl,
    originCode: evCd.split('-')[0] ?? evCd,
    // REGRESSION-FREEZE[ybtour-register-listing-title-fallback]: by-goods·first-display 제목 — manifest
    title: apiHit.listingTitle ?? null,
    nights: null,
    days: null,
    meetingInfo: null,
    includedBullets: inclExcl.includedItems.slice(0, 24),
    excludedBullets: inclExcl.excludedItems.slice(0, 24),
    shoppingPlaces,
    scheduleDays: scheduleDaysWithRoute,
    flights,
    priceRows,
    notes: [
      'source=ybtour_papi_by_goods',
      `evCd=${evCd}`,
      `goodsCd=${goodsCd}`,
      `calendar_rows=${priceRows.length}`,
      'price_collect=by_goods_adult_only',
      'detail_collect=notice_schedule_parallel',
      ...(usedTmRoute ? ['schedule_places=scheduleDetailTm'] : []),
      registerFactProductKindNote(inferRegisterFactProductKindFromOriginUrl('ybtour', originUrl)),
    ],
  }
}
