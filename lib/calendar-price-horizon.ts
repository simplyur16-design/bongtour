/**
 * 달력·출발일 가격 수집 지평선 SSOT — 향후 6개월(180일).
 *
 * REGRESSION-FREEZE[calendar-price-horizon-180d]: 180일·6개월 하한 — manifest
 *
 * 계약: `docs/ops/calendar-price-horizon-contract.md`
 */
import {
  CALENDAR_PRICE_HORIZON_DAYS,
  CALENDAR_PRICE_HORIZON_MONTHS_FORWARD,
} from '@/lib/calendar-price-horizon-constants'
import { addCalendarDaysToYmd, scrapeCalendarTodayYmd } from '@/lib/scrape-date-bounds'

export { CALENDAR_PRICE_HORIZON_DAYS, CALENDAR_PRICE_HORIZON_MONTHS_FORWARD }

export function calendarPriceHorizonEndYmd(todaySeoulYmd?: string): string {
  const today = (todaySeoulYmd ?? scrapeCalendarTodayYmd()).trim().slice(0, 10)
  return addCalendarDaysToYmd(today, CALENDAR_PRICE_HORIZON_DAYS)
}

/** inclusive `[from,to]` — API `searchFrom`/`searchTo`·배치 env 공통. */
export function calendarPriceHorizonDateRangeYmd(todaySeoulYmd?: string): {
  fromYmd: string
  toYmd: string
} {
  const fromYmd = (todaySeoulYmd ?? scrapeCalendarTodayYmd()).trim().slice(0, 10)
  return { fromYmd, toYmd: addCalendarDaysToYmd(fromYmd, CALENDAR_PRICE_HORIZON_DAYS) }
}
