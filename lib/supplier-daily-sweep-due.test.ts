import { describe, expect, it } from 'vitest'

import {
  SUPPLIER_DAILY_SWEEP_DUE_DAYS,
  horizonSoldOutPriceFromPatch,
  supplierDailySweepDueCutoff,
  supplierDailySweepDueOr,
  supplierDailySweepDueOrderBy,
} from '@/lib/supplier-daily-sweep-due'

// REGRESSION-FREEZE[supplier-sweep-due-last-price-observed]: due = lastPriceObservedAt — manifest
// REGRESSION-FREEZE[sweep-sold-out-honor-db-future-guard]: sold-out 마커는 DB 가드 존중 — manifest

describe('supplierDailySweepDueOr', () => {
  it('keys off lastPriceObservedAt, not lastSalesPolicyCheckedAt', () => {
    const cutoff = new Date('2026-08-25T00:00:00.000Z')
    const or = supplierDailySweepDueOr(cutoff)
    expect(or).toEqual([
      { lastPriceObservedAt: null },
      { lastPriceObservedAt: { lt: cutoff } },
    ])
    expect(JSON.stringify(or)).not.toContain('lastSalesPolicyCheckedAt')
  })

  it('orders oldest observed first', () => {
    expect(supplierDailySweepDueOrderBy()).toEqual([
      { lastPriceObservedAt: { sort: 'asc', nulls: 'first' } },
      { id: 'asc' },
    ])
  })

  it('cutoff is 1 day before now', () => {
    expect(SUPPLIER_DAILY_SWEEP_DUE_DAYS).toBe(1)
    const now = Date.parse('2026-08-26T15:00:00.000Z')
    expect(supplierDailySweepDueCutoff(now).toISOString()).toBe('2026-08-25T15:00:00.000Z')
  })
})

describe('horizonSoldOutPriceFromPatch', () => {
  it('does not null priceFrom when DB future-departure guard unmarked', () => {
    expect(
      horizonSoldOutPriceFromPatch({
        marked: false,
        noFutureDepartureConfirmedAt: null,
      }),
    ).toEqual({})
  })

  it('nulls priceFrom when marked sold-out', () => {
    expect(
      horizonSoldOutPriceFromPatch({
        marked: true,
        noFutureDepartureConfirmedAt: new Date('2026-08-26T00:00:00.000Z'),
      }),
    ).toEqual({ priceFrom: null })
  })
})
