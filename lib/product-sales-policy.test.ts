import { describe, expect, it } from 'vitest'
import {
  PUBLIC_DISPLAY_WINDOW_DAYS,
  RULE_A_WINDOW_DAYS,
  RULE_B_CUTOFF_DAYS,
  isProductHiddenByPolicy,
  publicListingCutoffUtcDate,
  publicProductWhereClause,
} from '@/lib/product-sales-policy'

/** lastFutureDepartureDate storage: UTC midnight of calendar YMD */
function atUtcYmd(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`)
}

describe('product-sales-policy visibility window', () => {
  it('splits 180d collection from 90d public display intent; Rule B = 3d', () => {
    expect(RULE_A_WINDOW_DAYS).toBe(180)
    expect(PUBLIC_DISPLAY_WINDOW_DAYS).toBe(90)
    expect(RULE_B_CUTOFF_DAYS).toBe(3)
  })

  it('last departure 2026-10-26: visible all KST day 10/23, hidden from 10/24 00:00 KST', () => {
    const last = atUtcYmd('2026-10-26')
    const product = {
      noFutureDepartureConfirmedAt: null,
      lastFutureDepartureDate: last,
    }
    const visibleInstants = [
      new Date('2026-10-23T00:00:00+09:00'),
      new Date('2026-10-23T09:00:00+09:00'),
      new Date('2026-10-23T23:59:00+09:00'),
    ]
    const hiddenInstants = [
      new Date('2026-10-24T00:00:00+09:00'),
      new Date('2026-10-24T09:00:00+09:00'),
      new Date('2026-10-24T23:59:00+09:00'),
    ]
    for (const now of visibleInstants) {
      expect(isProductHiddenByPolicy(product, now)).toBe(false)
      expect(publicListingCutoffUtcDate(now)).toEqual(atUtcYmd('2026-10-26'))
      expect(publicProductWhereClause(now)).toEqual({
        OR: [
          { lastFutureDepartureDate: { gte: atUtcYmd('2026-10-26') } },
          {
            AND: [{ lastFutureDepartureDate: null }, { noFutureDepartureConfirmedAt: null }],
          },
        ],
      })
    }
    for (const now of hiddenInstants) {
      expect(isProductHiddenByPolicy(product, now)).toBe(true)
      expect(publicListingCutoffUtcDate(now)).toEqual(atUtcYmd('2026-10-27'))
      expect(publicProductWhereClause(now)).toEqual({
        OR: [
          { lastFutureDepartureDate: { gte: atUtcYmd('2026-10-27') } },
          {
            AND: [{ lastFutureDepartureDate: null }, { noFutureDepartureConfirmedAt: null }],
          },
        ],
      })
    }
  })

  it('boundary: on D-3 (last == cutoff YMD) still visible', () => {
    const product = {
      noFutureDepartureConfirmedAt: null,
      lastFutureDepartureDate: atUtcYmd('2026-10-26'),
    }
    expect(isProductHiddenByPolicy(product, new Date('2026-10-23T12:00:00+09:00'))).toBe(false)
  })

  it('boundary: D-2 and later hide', () => {
    const product = {
      noFutureDepartureConfirmedAt: null,
      lastFutureDepartureDate: atUtcYmd('2026-10-26'),
    }
    expect(isProductHiddenByPolicy(product, new Date('2026-10-24T00:00:00+09:00'))).toBe(true)
    expect(isProductHiddenByPolicy(product, new Date('2026-10-25T09:00:00+09:00'))).toBe(true)
    expect(isProductHiddenByPolicy(product, new Date('2026-10-26T09:00:00+09:00'))).toBe(true)
  })

  it('marked with no last future departure is hidden', () => {
    expect(
      isProductHiddenByPolicy(
        {
          noFutureDepartureConfirmedAt: atUtcYmd('2026-10-01'),
          lastFutureDepartureDate: null,
        },
        new Date('2026-10-20T12:00:00+09:00'),
      ),
    ).toBe(true)
  })

  it('unevaluated product (no marker, no last) stays visible', () => {
    expect(
      isProductHiddenByPolicy(
        { noFutureDepartureConfirmedAt: null, lastFutureDepartureDate: null },
        new Date('2026-10-20T12:00:00+09:00'),
      ),
    ).toBe(false)
  })

  it('isProductHiddenByPolicy agrees with publicProductWhereClause for every case', () => {
    const cases: Array<{
      product: {
        noFutureDepartureConfirmedAt: Date | null
        lastFutureDepartureDate: Date | null
      }
      now: Date
    }> = [
      {
        product: {
          noFutureDepartureConfirmedAt: null,
          lastFutureDepartureDate: atUtcYmd('2026-10-26'),
        },
        now: new Date('2026-10-23T00:00:00+09:00'),
      },
      {
        product: {
          noFutureDepartureConfirmedAt: null,
          lastFutureDepartureDate: atUtcYmd('2026-10-26'),
        },
        now: new Date('2026-10-24T00:00:00+09:00'),
      },
      {
        product: {
          noFutureDepartureConfirmedAt: atUtcYmd('2026-10-01'),
          lastFutureDepartureDate: null,
        },
        now: new Date('2026-10-20T12:00:00+09:00'),
      },
      {
        product: { noFutureDepartureConfirmedAt: null, lastFutureDepartureDate: null },
        now: new Date('2026-10-20T12:00:00+09:00'),
      },
    ]
    for (const { product, now } of cases) {
      const hidden = isProductHiddenByPolicy(product, now)
      const clause = publicProductWhereClause(now)
      const cutoff = publicListingCutoffUtcDate(now)
      let matchesWhere: boolean
      if (product.lastFutureDepartureDate != null) {
        matchesWhere = product.lastFutureDepartureDate.getTime() >= cutoff.getTime()
      } else {
        matchesWhere =
          product.lastFutureDepartureDate == null && product.noFutureDepartureConfirmedAt == null
      }
      expect(matchesWhere).toBe(!hidden)
      expect(clause).toEqual({
        OR: [
          { lastFutureDepartureDate: { gte: cutoff } },
          {
            AND: [{ lastFutureDepartureDate: null }, { noFutureDepartureConfirmedAt: null }],
          },
        ],
      })
    }
  })
})
