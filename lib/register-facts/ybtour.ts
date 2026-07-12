/**
 * ybtour 등록 사실 수집 — papi evCd + event-schedule.
 *
 * REGRESSION-FREEZE[register-facts-foundation]: papi event/schedule — manifest
 */
import {
  collectYbtourByGoodsApiDepartureInputsForUrl,
  fetchYbtourEventFirstDisplay,
  resolveYbtourEvCdForRegisterUrl,
} from '@/lib/ybtour-api-departures'
import {
  extractYbtourIncludedExcluded,
  fetchYbtourRegisterDetailBundle,
  buildYbtourFlightStructuredFromTm,
} from '@/lib/ybtour-register-api-detail'
import { registerDepartureLikeToFactPriceRow } from '@/lib/register-fact-price-row'
import type { RegisterFactScheduleDay, RegisterFactFlightLeg, SupplierRegisterFactBundle } from '@/lib/register-facts/types'
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'
import {
  inferRegisterFactProductKindFromOriginUrl,
  registerFactProductKindNote,
} from '@/lib/register-facts/product-kind'
import { departureInputToYmd } from '@/lib/scrape-date-bounds'

const YBTOUR_PAPI_BASE = process.env.YBTOUR_PAPI_BASE_URL ?? 'https://papi.ybtour.co.kr'

type YbtourScheduleDayRow = {
  dayNo?: number
  accommNm?: string | null
  foodB?: string | null
  foodL?: string | null
  foodD?: string | null
  trvInfo?: string | null
}

async function fetchYbtourScheduleDays(
  evCd: string,
  goodsCd: string,
  referer: string,
): Promise<RegisterFactScheduleDay[]> {
  const url = `${YBTOUR_PAPI_BASE.replace(/\/$/, '')}/pkg/event-schedule/${encodeURIComponent(evCd)}/${encodeURIComponent(goodsCd)}`
  const res = await fetch(url, {
    headers: {
      accept: 'application/json',
      referer,
    },
  })
  if (!res.ok) return []
  const json = (await res.json()) as { code?: string; body?: { scheduleDetail?: YbtourScheduleDayRow[] } }
  if (json?.code !== '0000') return []

  const rows: RegisterFactScheduleDay[] = []
  for (const row of json.body?.scheduleDetail ?? []) {
    const day = Number(row.dayNo ?? 0)
    if (!Number.isFinite(day) || day <= 0) continue
    const meals = [row.foodB, row.foodL, row.foodD].map((x) => String(x ?? '').trim()).filter(Boolean)
    const hotel = String(row.accommNm ?? '').trim()
    rows.push({
      day,
      places: row.trvInfo ? [String(row.trvInfo).trim()] : [],
      hotels: hotel ? [hotel] : [],
      meals,
      transportNote: null,
    })
  }
  return rows.sort((a, b) => a.day - b.day)
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
  const [apiHit, display, scheduleDays, detailBundle] = await Promise.all([
    collectYbtourByGoodsApiDepartureInputsForUrl(originUrl, fromYmd, toYmd),
    fetchYbtourEventFirstDisplay(evCd, referer),
    fetchYbtourScheduleDays(evCd, goodsCd, referer),
    fetchYbtourRegisterDetailBundle(originUrl),
  ])

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

  return {
    supplier: 'ybtour',
    fetchedAt: new Date().toISOString(),
    originUrl,
    originCode: evCd.split('-')[0] ?? evCd,
    // REGRESSION-FREEZE[ybtour-register-listing-title-fallback]: by-goods·first-display 제목 — manifest
    title: apiHit.listingTitle ?? (display?.evNm?.trim() || null),
    nights: null,
    days: null,
    meetingInfo: null,
    includedBullets: inclExcl.includedItems.slice(0, 24),
    excludedBullets: inclExcl.excludedItems.slice(0, 24),
    shoppingPlaces,
    scheduleDays,
    flights,
    priceRows,
    notes: [
      'source=ybtour_papi_by_goods',
      `evCd=${evCd}`,
      `calendar_rows=${priceRows.length}`,
      registerFactProductKindNote(inferRegisterFactProductKindFromOriginUrl('ybtour', originUrl)),
    ],
  }
}
