/**
 * ybtour 등록 사실 수집 — papi evCd + event-schedule.
 *
 * REGRESSION-FREEZE[register-facts-foundation]: papi event/schedule — manifest
 */
import {
  collectYbtourByGoodsApiDepartureInputsForUrl,
  fetchYbtourEventFirstDisplay,
  parseYbtourEvCdFromUrl,
} from '@/lib/ybtour-api-departures'
import { registerDepartureLikeToFactPriceRow } from '@/lib/register-fact-price-row'
import type { RegisterFactScheduleDay, SupplierRegisterFactBundle } from '@/lib/register-facts/types'
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'
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

async function fetchYbtourScheduleDays(evCd: string, referer: string): Promise<RegisterFactScheduleDay[]> {
  const url = `${YBTOUR_PAPI_BASE.replace(/\/$/, '')}/pkg/event-schedule/${encodeURIComponent(evCd)}/${encodeURIComponent(evCd.split('-')[0] ?? evCd)}`
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

export async function collectYbtourRegisterFacts(originUrl: string): Promise<SupplierRegisterFactBundle | null> {
  const evCd = parseYbtourEvCdFromUrl(originUrl)
  if (!evCd) return null

  const referer = originUrl.trim() || `https://prdt.ybtour.co.kr/product/detailPackage?evCd=${evCd}`
  const fromYmd = kstTodayYmd()
  const toYmd = addDaysUtcYmd(fromYmd, RULE_A_WINDOW_DAYS)
  const [apiHit, display, scheduleDays] = await Promise.all([
    collectYbtourByGoodsApiDepartureInputsForUrl(originUrl, fromYmd, toYmd),
    fetchYbtourEventFirstDisplay(evCd, referer),
    fetchYbtourScheduleDays(evCd, referer),
  ])

  const priceRows = apiHit.inputs
    .map((dep) =>
      registerDepartureLikeToFactPriceRow({
        ...dep,
        supplierDepartureCode: dep.supplierDepartureCodeCandidate ?? null,
      }),
    )
    .filter((row): row is NonNullable<typeof row> => row != null)

  const firstInput = apiHit.inputs[0]

  return {
    supplier: 'ybtour',
    fetchedAt: new Date().toISOString(),
    originUrl,
    originCode: evCd.split('-')[0] ?? evCd,
    title: display?.evNm?.trim() || null,
    nights: null,
    days: null,
    meetingInfo: null,
    includedBullets: [],
    excludedBullets: [],
    shoppingPlaces: [],
    scheduleDays,
    flights: firstInput?.carrierName
      ? [
          {
            direction: 'outbound' as const,
            carrier: firstInput.carrierName,
            flightNo: firstInput.outboundFlightNo ?? null,
            departureCity: null,
            departureAt: departureInputToYmd(firstInput.departureDate),
            arrivalCity: null,
            arrivalAt: null,
          },
        ]
      : [],
    priceRows,
    notes: ['source=ybtour_papi_by_goods', `evCd=${evCd}`, `calendar_rows=${priceRows.length}`],
  }
}
