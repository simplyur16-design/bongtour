import { afterEach, describe, expect, it } from 'vitest'
import { shouldModetourSweepRetireOnSd1 } from '@/lib/modetour-sd1-policy'
import {
  MODETOUR_E2E_DEFER_DIGEST_THRESHOLD,
  __modetourE2eDeferStreakForTest,
  __resetModetourE2eDeferStreakForTest,
  recordModetourE2eModalDeferStreak,
} from '@/lib/modetour-sweep'

describe('modetour e2e defer streak', () => {
  afterEach(() => {
    __resetModetourE2eDeferStreakForTest()
  })

  it('counts consecutive defers per product', () => {
    expect(recordModetourE2eModalDeferStreak('p1')).toBe(1)
    expect(recordModetourE2eModalDeferStreak('p1')).toBe(2)
    expect(recordModetourE2eModalDeferStreak('p1')).toBe(MODETOUR_E2E_DEFER_DIGEST_THRESHOLD)
    expect(__modetourE2eDeferStreakForTest('p1')).toBe(3)
    expect(recordModetourE2eModalDeferStreak('p2')).toBe(1)
  })
})

describe('shouldModetourSweepRetireOnSd1', () => {
  it('retires travel packages on SD1', () => {
    expect(shouldModetourSweepRetireOnSd1({ listingKind: 'travel', productType: 'travel' })).toBe(true)
  })

  it('skips auto-retire for air_hotel_free', () => {
    expect(
      shouldModetourSweepRetireOnSd1({ listingKind: 'air_hotel_free', productType: 'air-hotel' }),
    ).toBe(false)
  })

  it('skips auto-retire for legacy airtel productType', () => {
    expect(shouldModetourSweepRetireOnSd1({ listingKind: 'travel', productType: 'airtel' })).toBe(
      false,
    )
  })

  it('retires travel packages on collect failure even when stale future departures remain', () => {
    expect(
      shouldModetourSweepRetireOnSd1(
        { listingKind: 'travel', productType: 'travel' },
        { hasFuturePricedDeparture: true },
      ),
    ).toBe(true)
  })
})
