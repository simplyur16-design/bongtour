import { describe, expect, it } from 'vitest'

import {
  SUPPLIER_DAILY_SWEEP_DUE_DAYS,
  supplierDailySweepDueCutoff,
  supplierDailySweepDueOr,
  supplierDailySweepDueOrderBy,
} from '@/lib/supplier-daily-sweep-due'

// REGRESSION-FREEZE[supplier-sweep-due-last-price-observed]: due = lastPriceObservedAt — manifest

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
