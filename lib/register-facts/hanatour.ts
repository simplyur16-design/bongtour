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
  extractHanatourIncludedExcluded,
  extractHanatourShoppingFromProdInfo,
  fetchHanatourPkgProdItnr,
  applyHanatourProdInfoHotelsToFactDays,
  hanatourItnrSchdToFactDays,
  type HanatourProdInfoExtended,
} from '@/lib/hanatour-register-api-detail'
import {
  inferHanatourRegisterFactProductKind,
  registerFactProductKindNote,
} from '@/lib/register-facts/product-kind'
import { registerDepartureLikeToFactPriceRow } from '@/lib/register-fact-price-row'
import type { RegisterFactScheduleDay, RegisterFactFlightLeg, SupplierRegisterFactBundle } from '@/lib/register-facts/types'
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'
import { departureInputToYmd } from '@/lib/scrape-date-bounds'

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export { hanatourItnrSchdToFactDays } from '@/lib/hanatour-register-api-detail'

export async function collectHanatourRegisterFacts(originUrl: string): Promise<SupplierRegisterFactBundle | null> {
  const pkgCd = parseHanatourPkgCdFromUrl(originUrl)
  if (!pkgCd) return null

  let info: Awaited<ReturnType<typeof fetchHanatourPkgProdInfo>> = null
  let itnr: Awaited<ReturnType<typeof fetchHanatourPkgProdItnr>> = null
  try {
    ;[info, itnr] = await Promise.all([fetchHanatourPkgProdInfo(pkgCd), fetchHanatourPkgProdItnr(pkgCd)])
  } catch (err) {
    console.error('[register-facts/hanatour] fetch failed', err)
    return null
  }

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
  const prodInfo = info as HanatourProdInfoExtended
  const { includedItems, excludedItems } = extractHanatourIncludedExcluded(prodInfo)
  const shoppingExtract = extractHanatourShoppingFromProdInfo(prodInfo)
  const productKind = inferHanatourRegisterFactProductKind(prodInfo, originUrl)

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
    includedBullets: includedItems,
    excludedBullets: excludedItems,
    shoppingPlaces: shoppingExtract.rows
      .map((r) => String(r.shoppingPlace ?? r.shoppingItem ?? '').trim())
      .filter(Boolean),
    scheduleDays: applyHanatourProdInfoHotelsToFactDays(
      hanatourItnrSchdToFactDays(schdInfoList),
      info as HanatourProdInfoExtended,
    ),
    flights: (() => {
      const legs: RegisterFactFlightLeg[] = []
      if (!firstInput) return legs
      if (
        firstInput.carrierName ||
        firstInput.outboundFlightNo ||
        firstInput.outboundDepartureAirport
      ) {
        legs.push({
          direction: 'outbound',
          carrier: firstInput.carrierName ?? null,
          flightNo: firstInput.outboundFlightNo ?? null,
          departureCity: firstInput.outboundDepartureAirport ?? null,
          departureAt: departureInputToYmd(firstInput.departureDate),
          arrivalCity: firstInput.outboundArrivalAirport ?? null,
          arrivalAt: null,
        })
      }
      if (firstInput.inboundDepartureAirport || firstInput.inboundFlightNo) {
        legs.push({
          direction: 'inbound',
          carrier: firstInput.carrierName ?? null,
          flightNo: firstInput.inboundFlightNo ?? null,
          departureCity: firstInput.inboundDepartureAirport ?? null,
          departureAt: null,
          arrivalCity: firstInput.inboundArrivalAirport ?? null,
          arrivalAt: null,
        })
      }
      return legs
    })(),
    priceRows,
    notes: [
      'source=hanatour_gw_api',
      `pkgCd=${pkgCd}`,
      `calendar_rows=${priceRows.length}`,
      registerFactProductKindNote(productKind),
    ],
  }
}
