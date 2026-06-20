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
import {
  fetchHanatourPkgProdItnr,
  formatHanatourTrvlExpnBullet,
  hanatourItnrSchdToFactDays,
  type HanatourTrvlExpnRow,
} from '@/lib/hanatour-register-api-detail'
import type { RegisterFactScheduleDay, SupplierRegisterFactBundle } from '@/lib/register-facts/types'

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export { hanatourItnrSchdToFactDays } from '@/lib/hanatour-register-api-detail'

export async function collectHanatourRegisterFacts(originUrl: string): Promise<SupplierRegisterFactBundle | null> {
  const pkgCd = parseHanatourPkgCdFromUrl(originUrl)
  if (!pkgCd) return null

  const [info, itnr] = await Promise.all([
    fetchHanatourPkgProdInfo(pkgCd),
    fetchHanatourPkgProdItnr(pkgCd),
  ])

  if (!info) return null

  const depInput = hanatourProdInfoToDepartureInput(info)
  const incl = (info as { trvlExpnInclList?: HanatourTrvlExpnRow[] }).trvlExpnInclList ?? []
  const excl = (info as { trvlExpnNoneInclList?: HanatourTrvlExpnRow[] }).trvlExpnNoneInclList ?? []
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
    includedBullets: incl.map((x) => formatHanatourTrvlExpnBullet(x)).filter(Boolean),
    excludedBullets: excl.map((x) => formatHanatourTrvlExpnBullet(x)).filter(Boolean),
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
