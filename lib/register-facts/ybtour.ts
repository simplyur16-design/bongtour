/**
 * ybtour 등록 사실 수집 — papi evCd + event-schedule.
 *
 * REGRESSION-FREEZE[register-facts-foundation]: papi event/schedule — manifest
 */
import {
  collectYbtourApiDepartureInputsForUrl,
  fetchYbtourEventFirstDisplay,
  parseYbtourEvCdFromUrl,
  ybtourYmdFromEvStartDt,
} from '@/lib/ybtour-api-departures'
import type { RegisterFactScheduleDay, SupplierRegisterFactBundle } from '@/lib/register-facts/types'

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
  const [apiHit, display, scheduleDays] = await Promise.all([
    collectYbtourApiDepartureInputsForUrl(originUrl),
    fetchYbtourEventFirstDisplay(evCd, referer),
    fetchYbtourScheduleDays(evCd, referer),
  ])

  const departureYmd = ybtourYmdFromEvStartDt(display?.evStartDt)
  const priceRow = apiHit.inputs[0]

  return {
    supplier: 'ybtour',
    fetchedAt: new Date().toISOString(),
    originUrl,
    originCode: evCd.split('-')[0] ?? evCd,
    title: display?.evNm?.trim() || apiHit.title,
    nights: null,
    days: null,
    meetingInfo: null,
    includedBullets: [],
    excludedBullets: [],
    shoppingPlaces: [],
    scheduleDays,
    flights: [],
    priceRows: priceRow
      ? [
          {
            departureDate: departureYmd,
            adultPrice: priceRow.adultPrice ?? null,
            childPrice: priceRow.childBedPrice ?? null,
            infantPrice: priceRow.infantPrice ?? null,
            supplierDepartureCode: priceRow.supplierDepartureCodeCandidate ?? null,
          },
        ]
      : [],
    notes: ['source=ybtour_papi', `evCd=${evCd}`],
  }
}
