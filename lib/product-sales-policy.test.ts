import { describe, expect, it } from 'vitest'
import {
  RULE_A_WINDOW_DAYS,
  RULE_B_CUTOFF_DAYS,
  isProductHiddenByPolicy,
  publicProductWhereClause,
} from '@/lib/product-sales-policy'

/** KST noon-ish UTC instant for calendar day YYYY-MM-DD */
function atUtcYmd(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`)
}

describe('product-sales-policy visibility window', () => {
  it('uses 3-month Rule A (90d) and 3-day Rule B', () => {
    expect(RULE_A_WINDOW_DAYS).toBe(90)
    expect(RULE_B_CUTOFF_DAYS).toBe(3)
  })

  it('last departure 10/26: shown through 10/23, hidden from 10/24', () => {
    const last = atUtcYmd('2026-10-26')
    const product = {
      noFutureDepartureConfirmedAt: null,
      lastFutureDepartureDate: last,
    }
    expect(isProductHiddenByPolicy(product, atUtcYmd('2026-10-23'))).toBe(false)
    expect(isProductHiddenByPolicy(product, atUtcYmd('2026-10-24'))).toBe(true)
  })

  it('boundary: on cutoff day (last == now+3) still visible', () => {
    const product = {
      noFutureDepartureConfirmedAt: null,
      lastFutureDepartureDate: atUtcYmd('2026-10-26'),
    }
    // now 10/23 → cutoff 10/26 → last >= cutoff → show
    expect(isProductHiddenByPolicy(product, atUtcYmd('2026-10-23'))).toBe(false)
  })

  it('boundary: day after cutoff start hides', () => {
    const product = {
      noFutureDepartureConfirmedAt: null,
      lastFutureDepartureDate: atUtcYmd('2026-10-26'),
    }
    expect(isProductHiddenByPolicy(product, atUtcYmd('2026-10-24'))).toBe(true)
    expect(isProductHiddenByPolicy(product, atUtcYmd('2026-10-25'))).toBe(true)
    expect(isProductHiddenByPolicy(product, atUtcYmd('2026-10-26'))).toBe(true)
  })

  it('marked with no last future departure is hidden', () => {
    expect(
      isProductHiddenByPolicy(
        {
          noFutureDepartureConfirmedAt: atUtcYmd('2026-10-01'),
          lastFutureDepartureDate: null,
        },
        atUtcYmd('2026-10-20'),
      ),
    ).toBe(true)
  })

  it('unevaluated product (no marker, no last) stays visible', () => {
    expect(
      isProductHiddenByPolicy(
        { noFutureDepartureConfirmedAt: null, lastFutureDepartureDate: null },
        atUtcYmd('2026-10-20'),
      ),
    ).toBe(false)
  })

  it('publicProductWhereClause matches isProductHiddenByPolicy for 10/26 example', () => {
    const now = atUtcYmd('2026-10-24')
    const clause = publicProductWhereClause(now)
    expect(clause).toEqual({
      OR: [
        { lastFutureDepartureDate: { gte: atUtcYmd('2026-10-27') } },
        {
          AND: [{ lastFutureDepartureDate: null }, { noFutureDepartureConfirmedAt: null }],
        },
      ],
    })
  })
})
