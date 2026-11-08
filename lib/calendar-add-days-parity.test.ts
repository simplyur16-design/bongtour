import { describe, expect, it } from 'vitest'
import { formatDepartureDateYmd } from '@/lib/calendar-batch-cursor'
import { computeProductBatchWindow, addCalendarDaysYmd } from '@/lib/calendar-batch-product-window'
import { addCalendarDaysToYmd, departureInputToYmd } from '@/lib/scrape-date-bounds'

const BASES = [
  '2024-02-28',
  '2024-02-29',
  '2025-02-28',
  '2026-01-31',
  '2026-02-27',
  '2026-02-28',
  '2026-03-01',
  '2026-03-31',
  '2026-04-11',
  '2026-04-30',
  '2026-11-08',
  '2026-12-31',
  '2027-01-01',
  '2028-02-28',
  '2028-02-29',
]

const DELTAS = [-400, -366, -31, -1, 0, 1, 2, 3, 27, 28, 29, 30, 31, 59, 90, 180, 365, 366, 400]

describe('calendar day adders', () => {
  it('keeps collection-window and scrape-floor addition identical on month and leap edges', () => {
    for (const ymd of BASES) {
      for (const delta of DELTAS) {
        expect(addCalendarDaysYmd(ymd, delta)).toBe(addCalendarDaysToYmd(ymd, delta))
      }
    }
  })

  it('does not change the 30-day collection window across a month boundary', () => {
    const window = computeProductBatchWindow({
      cursorYmd: null,
      retired: false,
      maxDepartureYmd: null,
      todaySeoulYmd: '2026-01-31',
      horizonYmd: '2026-07-31',
      hasFutureDepartures: false,
    })
    expect(window.rangeStartYmd).toBe('2026-01-31')
    expect(window.rangeEndYmd).toBe('2026-03-01')
    expect(window.windowEmpty).toBe(false)
  })

  it('keeps the verygoodtour floor example of today+3', () => {
    expect(addCalendarDaysToYmd('2026-04-11', 3)).toBe('2026-04-14')
    expect(addCalendarDaysYmd('2026-04-11', 3)).toBe('2026-04-14')
  })

  it('agrees on a UTC-midnight departure instant and does not merge the KST evening edge', () => {
    const stored = new Date(Date.UTC(2026, 10, 8, 0, 0, 0))
    expect(formatDepartureDateYmd(stored)).toBe('2026-11-08')
    expect(departureInputToYmd(stored)).toBe('2026-11-08')

    const eveningUtc = new Date(Date.UTC(2026, 10, 8, 15, 0, 0))
    expect(formatDepartureDateYmd(eveningUtc)).toBe('2026-11-08')
    expect(departureInputToYmd(eveningUtc)).toBe('2026-11-09')
  })
})
