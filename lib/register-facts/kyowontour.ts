/**
 * kyowontour 등록 사실 수집 — goodsEventDetail + tourEventTabData + differentDepartDate AJAX.
 *
 * REGRESSION-FREEZE[register-facts-foundation]: tourEventTabData·calendar AJAX·tourCode detail enrich — manifest
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
import { kyowontourCalendarRowToFactPriceRow } from '@/lib/register-fact-price-row'
import type { RegisterFactScheduleDay, SupplierRegisterFactBundle } from '@/lib/register-facts/types'
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'
import type { RegisterScheduleDay } from '@/lib/register-llm-schema-kyowontour'

const KYOWONTOUR_BASE = process.env.KYOWONTOUR_BASE_URL ?? 'https://www.kyowontour.com'

function parseTourCodeFromUrl(originUrl: string): string | null {
  const m = originUrl.match(/[?&]tourCode=([^&]+)/i)
  return m?.[1]?.trim() || null
}

function extractTitleFromDetailHtml(html: string): string | null {
  const og = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)?.[1]
  if (og?.trim()) return og.trim()
  const h1 = html.match(/<h1[^>]*class="[^"]*tit[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
  if (h1) return h1.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null
  return null
}

function registerScheduleToFactDays(days: RegisterScheduleDay[]): RegisterFactScheduleDay[] {
  return days.map((d) => {
    const places = d.routeText
      ? d.routeText
          .split(/\s*-\s*/)
          .map((x) => x.trim())
          .filter(Boolean)
      : d.title?.trim()
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

export async function collectKyowontourRegisterFacts(originUrl: string): Promise<SupplierRegisterFactBundle | null> {
  const url =
    originUrl.trim() ||
    `${KYOWONTOUR_BASE.replace(/\/$/, '')}/goods/goodsEventDetail?tourCode=${encodeURIComponent(parseTourCodeFromUrl(originUrl) ?? '')}`
  if (!url || !/kyowontour\.com/i.test(url)) return null

  const tourCode = parseTourCodeFromUrl(url)
  if (!tourCode) return null

  const res = await fetch(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'ko-KR',
      referer: KYOWONTOUR_BASE,
    },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) return null
  const html = await res.text()
  const hidden = extractKyowontourHiddenFieldsFromDetailHtml(html)
  if (!hidden) return null

  const title = extractTitleFromDetailHtml(html)
  const tabRes = await fetchKyowontourTourEventTabData(
    hidden,
    [KYOWONTOUR_TAB_CORE_ID, KYOWONTOUR_TAB_SCHEDULE_ID],
    { refererUrl: url },
  )
  const coreDetail = extractTabDetailFromTabData(tabRes.data, KYOWONTOUR_TAB_CORE_ID)
  const scheduleDetail = extractTabDetailFromTabData(tabRes.data, KYOWONTOUR_TAB_SCHEDULE_ID)
  const core = parseKyowontourCoreTabDetail(coreDetail)
  const scheduleTab = parseKyowontourScheduleTabDetail(scheduleDetail)
  const scheduleDays = registerScheduleToFactDays(scheduleTabParsedToRegisterDays(scheduleTab))

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
  const priceRows = enrichedRows
    .filter((r) => r.adultPriceFromCalendar > 0 && r.departDate && r.departDate >= fromYmd && r.departDate <= toYmd)
    .map((r) => kyowontourCalendarRowToFactPriceRow(r))
    .filter((row): row is NonNullable<typeof row> => row != null)

  const nightsDays = html.match(/(\d+)\s*박\s*(\d+)\s*일/)

  return {
    supplier: 'kyowontour',
    fetchedAt: new Date().toISOString(),
    originUrl: url,
    originCode: hidden.tourCode,
    title,
    nights: nightsDays ? Number(nightsDays[1]) : null,
    days: nightsDays ? Number(nightsDays[2]) : scheduleTab.dayCount || null,
    meetingInfo: scheduleTab.meetingText,
    includedBullets: core.includedItems.slice(0, 24),
    excludedBullets: core.excludedItems.slice(0, 24),
    shoppingPlaces: [],
    scheduleDays,
    flights: [],
    priceRows,
    notes: [
      'source=kyowontour_tab_data_and_calendar_ajax',
      `tourCode=${hidden.tourCode}`,
      `masterCode=${hidden.masterCode}`,
      `calendar_rows=${enrichedRows.length}`,
      'tourcode_detail_enrich=goodsEventDetail_ssr',
    ],
  }
}
