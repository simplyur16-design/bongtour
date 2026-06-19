import { describe, expect, it } from 'vitest'
import {
  computeBaselineAdultPriceOnUpsert,
  isUrgentDealDeparture,
  pickNearestUrgentDealDeparture,
} from '@/lib/supplier-urgent-deal'

describe('computeBaselineAdultPriceOnUpsert', () => {
  it('keeps existing baseline', () => {
    expect(
      computeBaselineAdultPriceOnUpsert({ adultPrice: 900_000, baselineAdultPrice: 1_000_000 }, 850_000),
    ).toBe(1_000_000)
  })

  it('sets baseline from first adult price', () => {
    expect(computeBaselineAdultPriceOnUpsert(undefined, 1_200_000)).toBe(1_200_000)
  })
})

describe('pickNearestUrgentDealDeparture', () => {
  it('picks nearest drop within 30d window', () => {
    const nearest = pickNearestUrgentDealDeparture(
      [
        {
          departureDate: new Date('2026-07-10T00:00:00.000Z'),
          baselineAdultPrice: 1_000_000,
          adultPrice: 900_000,
        },
        {
          departureDate: new Date('2026-07-20T00:00:00.000Z'),
          baselineAdultPrice: 1_000_000,
          adultPrice: 850_000,
        },
      ],
      '2026-06-20',
    )
    expect(nearest?.departureDateYmd).toBe('2026-07-10')
    expect(nearest?.current).toBe(900_000)
  })

  it('ignores rows without price drop', () => {
    expect(
      isUrgentDealDeparture(
        {
          departureDate: new Date('2026-07-10T00:00:00.000Z'),
          baselineAdultPrice: 900_000,
          adultPrice: 950_000,
        },
        '2026-06-20',
        '2026-07-20',
      ),
    ).toBe(false)
  })
})
