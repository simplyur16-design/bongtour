/**
 * hanatour 등록 사실 수집 — gw.hanatour.com 구조화 API.
 *
 * REGRESSION-FREEZE[register-facts-foundation]: getPkgProdInfo·getPkgProdItnrInfo — manifest
 */
import {
  fetchHanatourPkgProdInfo,
  hanatourProdInfoToDepartureInput,
  parseHanatourPkgCdFromUrl,
} from '@/lib/hanatour-api-departures'
import type { RegisterFactScheduleDay, SupplierRegisterFactBundle } from '@/lib/register-facts/types'

const HANATOUR_GW_BASE = process.env.HANATOUR_GW_BASE_URL ?? 'https://gw.hanatour.com'
const HANATOUR_TRP_PRG_MID = 'CHPC0PKG0200M200'

function hanatourGwHeaders(): HeadersInit {
  return {
    accept: 'application/json, text/plain, */*',
    'content-type': 'application/json',
    referer: 'https://www.hanatour.com/',
    prgmid: HANATOUR_TRP_PRG_MID,
  }
}

async function postHanatourGw<T>(path: string, body: unknown): Promise<T | null> {
  const res = await fetch(`${HANATOUR_GW_BASE}${path}?_siteId=hanatour`, {
    method: 'POST',
    headers: hanatourGwHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) return null
  return (await res.json()) as T
}

type HanatourItnrSchdMain = {
  schdCatgNm?: string | null
  schdCont?: string | null
  schdTitlNm?: string | null
}

type HanatourItnrSchdDay = {
  schdDay?: number
  schdMainInfoList?: HanatourItnrSchdMain[]
}

type HanatourItnrResponse = {
  data?: {
    meetInfoBcVo?: { fstMeetCont?: string | null }
    schdInfoList?: HanatourItnrSchdDay[]
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function hanatourItnrSchdToFactDays(schdInfoList: HanatourItnrSchdDay[]): RegisterFactScheduleDay[] {
  const rows: RegisterFactScheduleDay[] = []
  for (const dayRow of schdInfoList) {
    const day = Number(dayRow.schdDay ?? 0)
    if (!Number.isFinite(day) || day <= 0) continue
    const fact: RegisterFactScheduleDay = {
      day,
      places: [],
      hotels: [],
      meals: [],
      transportNote: null,
    }
    for (const main of dayRow.schdMainInfoList ?? []) {
      const cat = String(main.schdCatgNm ?? '').trim()
      const title = stripHtml(String(main.schdTitlNm ?? main.schdCont ?? '')).slice(0, 200)
      if (!title) continue
      if (cat.includes('관광')) fact.places.push(title)
      else if (cat.includes('숙박') || cat.includes('호텔')) fact.hotels.push(title)
      else if (cat.includes('식사')) fact.meals.push(title)
      else if (cat.includes('이동') || cat.includes('항공')) {
        fact.transportNote = fact.transportNote ? `${fact.transportNote}; ${title}` : title
      } else {
        fact.places.push(title)
      }
    }
    rows.push(fact)
  }
  return rows.sort((a, b) => a.day - b.day)
}

export async function collectHanatourRegisterFacts(originUrl: string): Promise<SupplierRegisterFactBundle | null> {
  const pkgCd = parseHanatourPkgCdFromUrl(originUrl)
  if (!pkgCd) return null

  const [info, itnr] = await Promise.all([
    fetchHanatourPkgProdInfo(pkgCd),
    postHanatourGw<HanatourItnrResponse>('/package/pkg/api/common/pkgcomprod/getPkgProdItnrInfo/v1.00', {
      pkgCd,
    }),
  ])

  if (!info) return null

  const depInput = hanatourProdInfoToDepartureInput(info)
  const incl = (info as { trvlExpnInclList?: Array<{ trvlExpnNm?: string }> }).trvlExpnInclList ?? []
  const excl = (info as { trvlExpnNoneInclList?: Array<{ trvlExpnNm?: string }> }).trvlExpnNoneInclList ?? []
  const shopping = (info as { shpnInfoList?: Array<{ shpnPlcNm?: string }> }).shpnInfoList ?? []

  const meetRaw = itnr?.data?.meetInfoBcVo?.fstMeetCont ?? null
  const schdInfoList = itnr?.data?.schdInfoList ?? []

  return {
    supplier: 'hanatour',
    fetchedAt: new Date().toISOString(),
    originUrl,
    originCode: pkgCd,
    title: String(info.saleProdNm ?? '').trim() || null,
    nights: Number.isFinite(Number((info as { trvlNgtCnt?: number }).trvlNgtCnt))
      ? Number((info as { trvlNgtCnt?: number }).trvlNgtCnt)
      : null,
    days: Number.isFinite(Number((info as { trvlDayCnt?: number }).trvlDayCnt))
      ? Number((info as { trvlDayCnt?: number }).trvlDayCnt)
      : null,
    meetingInfo: meetRaw ? stripHtml(String(meetRaw)).slice(0, 500) : null,
    includedBullets: incl.map((x) => String(x.trvlExpnNm ?? '').trim()).filter(Boolean),
    excludedBullets: excl.map((x) => String(x.trvlExpnNm ?? '').trim()).filter(Boolean),
    shoppingPlaces: shopping.map((x) => String(x.shpnPlcNm ?? '').trim()).filter(Boolean),
    scheduleDays: hanatourItnrSchdToFactDays(schdInfoList),
    flights: depInput?.carrierName
      ? [
          {
            direction: 'outbound' as const,
            carrier: depInput.carrierName,
            flightNo: depInput.outboundFlightNo ?? null,
            departureCity: null,
            departureAt: depInput.departureDate ? String(depInput.departureDate) : null,
            arrivalCity: null,
            arrivalAt: null,
          },
        ]
      : [],
    priceRows: depInput
      ? [
          {
            departureDate: depInput.departureDate ? String(depInput.departureDate).slice(0, 10) : null,
            adultPrice: depInput.adultPrice ?? null,
            childPrice: depInput.childBedPrice ?? null,
            infantPrice: depInput.infantPrice ?? null,
            supplierDepartureCode: depInput.supplierDepartureCodeCandidate ?? null,
          },
        ]
      : [],
    notes: ['source=hanatour_gw_api', `pkgCd=${pkgCd}`],
  }
}
