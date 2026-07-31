/**
 * kyowontour 등록 사실 수집 — goodsEventDetail + tourEventTabData + differentDepartDate AJAX.
 *
 * REGRESSION-FREEZE[register-facts-foundation]: tourEventTabData·calendar AJAX·URL HTML 3슬롯 — manifest
 * REGRESSION-FREEZE[register-facts-fetch-resilience]: N× tourCode SSR enrich 생략 — URL HTML 1회 3슬롯만 — manifest
 */
import { collectKyowontourCalendarRange } from '@/lib/kyowontour-departures'
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
import { applyKyowontourUrlDetailThreeSlotToCalendarRows, synthesizeKyowontourUrlAnchorCalendarRow } from '@/lib/kyowontour-tourcode-detail-meta'
import { filterKyowontourCalendarRowsByUrlTourCodeLine } from '@/lib/kyowontour-tourcode-line'
import { kyowontourCalendarRowToFactPriceRow } from '@/lib/register-fact-price-row'
import type { RegisterFactFlightLeg, RegisterFactScheduleDay, SupplierRegisterFactBundle } from '@/lib/register-facts/types'
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'
import {
  inferRegisterFactProductKindFromOriginUrl,
  registerFactProductKindNote,
} from '@/lib/register-facts/product-kind'
import { kyowontourCalendarRowsToRegisterFactFlights } from '@/lib/register-facts/kyowontour-register-fact-flights'
import type { RegisterScheduleDay } from '@/lib/register-llm-schema-kyowontour'
import {
  extractKyowontourAirlineNameFromDetailHtml,
  extractKyowontourProductTitleFromDetailHtml,
} from '@/lib/kyowontour-register-api-detail'

const KYOWONTOUR_BASE = process.env.KYOWONTOUR_BASE_URL ?? 'https://www.kyowontour.com'

function parseTourCodeFromUrl(originUrl: string): string | null {
  const m = originUrl.match(/[?&]tourCode=([^&]+)/i)
  return m?.[1]?.trim() || null
}

function extractTitleFromDetailHtml(html: string): string | null {
  return extractKyowontourProductTitleFromDetailHtml(html)
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

  // CI live 게이트에서 연속 수집 시 교원 HTML(600KB+)이 30s에 끊기면 null bundle이 난다.
  // REGRESSION-FREEZE[register-facts-fetch-resilience]: detail HTML retry — manifest
  let html: string | null = null
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: {
          accept: 'text/html,application/xhtml+xml',
          'accept-language': 'ko-KR',
          referer: KYOWONTOUR_BASE,
        },
        signal: AbortSignal.timeout(60_000),
      })
      if (!res.ok) {
        if (attempt < 3) await new Promise((r) => setTimeout(r, 1500 * attempt))
        continue
      }
      html = await res.text()
      break
    } catch {
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1500 * attempt))
    }
  }
  if (!html) return null
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

  // monthEvtList 날짜별 dayAirList — 월초 seed만 쓰면 08-01·이스타 변형이 URL(7C) 라인을 덮음
  // REGRESSION-FREEZE[register-facts-fetch-resilience]: skipPerDateDayAirFetch false — monthEvt dayAir — manifest
  const cal = await collectKyowontourCalendarRange(hidden.masterCode, {
    monthCount: 6,
    disableE2EFallback: true,
    skipPerDateDayAirFetch: false,
    tourCodeForE2EFallback: hidden.tourCode,
    refererUrl: url,
    logLabel: 'register-facts-kyowontour',
  })
  // REGRESSION-FREEZE[kyowontour-tourcode-line]: URL tourCode 항공 변형(7C≠ZE) 필터 — manifest
  const lineRows = filterKyowontourCalendarRowsByUrlTourCodeLine(cal.rows, hidden.tourCode)
  // REGRESSION-FREEZE[register-facts-fetch-resilience]: N× tourCode SSR enrich 생략 — URL HTML 1회 3슬롯만 — manifest
  // REGRESSION-FREEZE[kyowontour-tourcode-detail-meta]: applyUrlDetailThreeSlot — manifest
  let enrichedRows = applyKyowontourUrlDetailThreeSlotToCalendarRows(
    lineRows,
    html,
    hidden.tourCode,
  )
  const urlTc = hidden.tourCode.trim()
  if (urlTc && !enrichedRows.some((r) => r.tourCode.trim() === urlTc)) {
    const airlineFromHtml = extractKyowontourAirlineNameFromDetailHtml(html)
    const anchor = synthesizeKyowontourUrlAnchorCalendarRow({
      html,
      urlTourCode: urlTc,
      airlineName: airlineFromHtml,
    })
    if (anchor) enrichedRows = [anchor, ...enrichedRows]
  }

  const fromYmd = kstTodayYmd()
  const toYmd = addDaysUtcYmd(fromYmd, RULE_A_WINDOW_DAYS)
  const priceRows = enrichedRows
    .filter((r) => r.adultPriceFromCalendar > 0 && r.departDate && r.departDate >= fromYmd && r.departDate <= toYmd)
    .map((r) => kyowontourCalendarRowToFactPriceRow(r))
    .filter((row): row is NonNullable<typeof row> => row != null)

  const flights = kyowontourCalendarRowsToRegisterFactFlights(
    enrichedRows,
    scheduleTab.meetingText,
    urlTc || null,
  )

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
    flights,
    priceRows,
    notes: [
      'source=kyowontour_tab_data_and_calendar_ajax',
      `tourCode=${hidden.tourCode}`,
      `masterCode=${hidden.masterCode}`,
      `calendar_rows=${enrichedRows.length}`,
      'tourcode_detail_enrich=url_html_three_slot_only',
      registerFactProductKindNote(inferRegisterFactProductKindFromOriginUrl('kyowontour', url)),
    ],
  }
}
