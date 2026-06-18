import { describe, expect, it } from 'vitest'
import {
  CALENDAR_PRICE_HORIZON_DAYS,
  CALENDAR_PRICE_HORIZON_MONTHS_FORWARD,
  calendarPriceHorizonDateRangeYmd,
  calendarPriceHorizonEndYmd,
} from '@/lib/calendar-price-horizon'

describe('calendar-price-horizon SSOT', () => {
  it('uses 180-day / 6-month horizon', () => {
    expect(CALENDAR_PRICE_HORIZON_DAYS).toBe(180)
    expect(CALENDAR_PRICE_HORIZON_MONTHS_FORWARD).toBe(6)
  })

  it('calendarPriceHorizonEndYmd adds 180 days', () => {
    expect(calendarPriceHorizonEndYmd('2026-06-18')).toBe('2026-12-15')
  })

  it('calendarPriceHorizonDateRangeYmd is inclusive from anchor', () => {
    const r = calendarPriceHorizonDateRangeYmd('2026-01-01')
    expect(r.fromYmd).toBe('2026-01-01')
    expect(r.toYmd).toBe('2026-06-30')
  })
})
