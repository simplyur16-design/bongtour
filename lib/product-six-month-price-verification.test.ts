import { describe, expect, it } from 'vitest'
import {
  hasPricedDepartureInSeoulWindow,
  hasPricedFutureDepartureInput,
  isEligibleForSixMonthNoPriceProductPurge,
  resolveSixMonthCalendarVerificationMarker,
} from '@/lib/product-six-month-price-verification'

describe('product-six-month-price-verification', () => {
  it('requires E2E or live-scrape marker before purge eligibility', () => {
    expect(
      isEligibleForSixMonthNoPriceProductPurge({
        product: { rawMeta: null, noFutureDepartureConfirmedAt: null },
        departures: [],
        todaySeoulYmd: '2026-06-03',
      }).eligible,
    ).toBe(false)

    expect(
      isEligibleForSixMonthNoPriceProductPurge({
        product: {
          rawMeta: JSON.stringify({ calendarBatchRetired: true }),
          noFutureDepartureConfirmedAt: null,
        },
        departures: [],
        todaySeoulYmd: '2026-06-03',
      }).eligible,
    ).toBe(true)
  })

  it('does not purge when priced departure exists in 6-month window', () => {
    const r = isEligibleForSixMonthNoPriceProductPurge({
      product: { noFutureDepartureConfirmedAt: new Date() },
      departures: [{ departureDate: '2026-07-01', adultPrice: 900_000 }],
      todaySeoulYmd: '2026-06-03',
    })
    expect(r.eligible).toBe(false)
  })

  it('resolveSixMonthCalendarVerificationMarker collects both marker types', () => {
    expect(
      resolveSixMonthCalendarVerificationMarker({
        rawMeta: JSON.stringify({ calendarBatchRetired: true }),
        noFutureDepartureConfirmedAt: new Date(),
      }).sources,
    ).toEqual(['calendar_batch_retired', 'no_future_departure_confirmed'])
  })

  it('hasPricedFutureDepartureInput ignores zero-price future rows', () => {
    expect(
      hasPricedFutureDepartureInput(
        [{ departureDate: '2026-07-01', adultPrice: 0 }],
        '2026-06-03',
      ),
    ).toBe(false)
    expect(
      hasPricedFutureDepartureInput(
        [{ departureDate: '2026-07-01', adultPrice: 1 }],
        '2026-06-03',
      ),
    ).toBe(true)
  })

  it('hasPricedDepartureInSeoulWindow respects horizon bounds', () => {
    expect(
      hasPricedDepartureInSeoulWindow(
        [{ departureDate: '2027-01-01', adultPrice: 1_000_000 }],
        '2026-06-03',
        '2026-12-01',
      ),
    ).toBe(false)
  })
})
