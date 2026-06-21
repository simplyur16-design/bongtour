/**
 * kyowontour detail-collect 축 카운트 — tab data SSOT.
 * REGRESSION-FREEZE[register-facts-completeness]
 */
import { collectKyowontourCalendarRange } from '@/lib/kyowontour-departures'
import { enrichKyowontourCalendarRowsWithTourCodeDetail } from '@/lib/kyowontour-tourcode-detail-meta'
import { scheduleTabParsedToRegisterDays } from '@/lib/kyowontour-register-schedule-collect'
import {
  KYOWONTOUR_TAB_CORE_ID,
  KYOWONTOUR_TAB_SCHEDULE_ID,
  extractKyowontourHiddenFieldsFromDetailHtml,
  extractTabDetailFromTabData,
  fetchKyowontourTourEventTabData,
  parseKyowontourCoreTabDetail,
  parseKyowontourScheduleTabDetail,
} from '@/lib/kyowontour-tour-event-tab-data'
import type { RegisterFactDetailParityMetrics } from '@/lib/register-facts/detail-parity-metrics'
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'

const KYOWONTOUR_BASE = process.env.KYOWONTOUR_BASE_URL ?? 'https://www.kyowontour.com'

export async function fetchKyowontourRegisterDetailParityMetrics(
  originUrl: string,
): Promise<RegisterFactDetailParityMetrics | null> {
  const url = originUrl.trim()
  if (!url) return null

  const detailRes = await fetch(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'ko-KR',
      referer: KYOWONTOUR_BASE,
    },
    signal: AbortSignal.timeout(30_000),
  })
  if (!detailRes.ok) return null
  const html = await detailRes.text()
  const hidden = extractKyowontourHiddenFieldsFromDetailHtml(html)
  if (!hidden) return null

  const tabRes = await fetchKyowontourTourEventTabData(
    hidden,
    [KYOWONTOUR_TAB_CORE_ID, KYOWONTOUR_TAB_SCHEDULE_ID],
    { refererUrl: url },
  )
  const coreDetail = extractTabDetailFromTabData(tabRes.data, KYOWONTOUR_TAB_CORE_ID)
  const scheduleDetail = extractTabDetailFromTabData(tabRes.data, KYOWONTOUR_TAB_SCHEDULE_ID)
  const core = parseKyowontourCoreTabDetail(coreDetail)
  const scheduleTab = parseKyowontourScheduleTabDetail(scheduleDetail)
  const scheduleDays = scheduleTabParsedToRegisterDays(scheduleTab).length

  const cal = await collectKyowontourCalendarRange(hidden.masterCode, {
    monthCount: 6,
    disableE2EFallback: true,
    tourCodeForE2EFallback: hidden.tourCode,
    refererUrl: url,
  })
  const enrichedRows = await enrichKyowontourCalendarRowsWithTourCodeDetail(cal.rows, {
    menuCode: hidden.menuCode,
    refererUrl: url,
  })

  const fromYmd = kstTodayYmd()
  const toYmd = addDaysUtcYmd(fromYmd, RULE_A_WINDOW_DAYS)
  const priceRows = enrichedRows.filter(
    (r) => r.adultPriceFromCalendar > 0 && r.departDate && r.departDate >= fromYmd && r.departDate <= toYmd,
  ).length
  const detailFlightSignal = Boolean(enrichedRows.map((r) => r.airline?.trim()).find(Boolean))

  return {
    detailScheduleDays: scheduleDays,
    detailIncludedCount: core.includedItems.length,
    detailExcludedCount: core.excludedItems.length,
    detailShoppingCount: 0,
    detailFlightSignal,
    detailPriceRows: priceRows,
  }
}
