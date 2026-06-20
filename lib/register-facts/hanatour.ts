/**
 * hanatour 등록 사실 수집 — gw.hanatour.com 구조화 API.
 *
 * REGRESSION-FREEZE[register-facts-foundation]: getPkgProdInfo·getPkgProdItnrInfo — manifest
 */
import {
  collectHanatourApiDepartureInputsForMonths,
  fetchHanatourPkgProdInfo,
  parseHanatourPkgCdFromUrl,
} from '@/lib/hanatour-api-departures'
import { buildHanatourKstTargetMonths } from '@/lib/hanatour-departures'
import {
  fetchHanatourPkgProdItnr,
  formatHanatourTrvlExpnBullet,
  hanatourItnrSchdToFactDays,
  type HanatourTrvlExpnRow,
} from '@/lib/hanatour-register-api-detail'
import { registerDepartureLikeToFactPriceRow } from '@/lib/register-fact-price-row'
import type { RegisterFactScheduleDay, SupplierRegisterFactBundle } from '@/lib/register-facts/types'
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'
import { departureInputToYmd } from '@/lib/scrape-date-bounds'

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

  const fromYmd = kstTodayYmd()
  const toYmd = addDaysUtcYmd(fromYmd, RULE_A_WINDOW_DAYS)
  const monthYms = buildHanatourKstTargetMonths(6)
  const cal = await collectHanatourApiDepartureInputsForMonths(pkgCd, monthYms)
  const priceRows = cal.inputs
    .filter((x) => {
      const d = departureInputToYmd(x.departureDate)
      return d != null && d >= fromYmd && d <= toYmd && (x.adultPrice ?? 0) > 0
    })
    .map((dep) =>
      registerDepartureLikeToFactPriceRow({
        ...dep,
        supplierDepartureCode: dep.supplierDepartureCodeCandidate ?? null,
      }),
    )
    .filter((row): row is NonNullable<typeof row> => row != null)

  const firstInput = cal.inputs[0]
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
    notes: ['source=hanatour_gw_api', `pkgCd=${pkgCd}`, `calendar_rows=${priceRows.length}`],
  }
}
