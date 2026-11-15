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

type PolicyProduct = {
  noFutureDepartureConfirmedAt: Date | null
  lastFutureDepartureDate: Date | null
  listingKind?: string | null
}

function expectedClause(cutoff: Date) {
  return {
    OR: [
      { lastFutureDepartureDate: { gte: cutoff } },
      {
        AND: [
          { listingKind: 'overseas_training' },
          { lastFutureDepartureDate: null },
          { noFutureDepartureConfirmedAt: null },
        ],
      },
    ],
  }
}

/** publicProductWhereClause 와 같은 의미를 메모리에서 평가 — isProductHiddenByPolicy 와 동치인지 확인. */
function matchesPublicWhere(product: PolicyProduct, now: Date): boolean {
  const cutoff = publicListingCutoffUtcDate(now)
  if (product.lastFutureDepartureDate != null) {
    return product.lastFutureDepartureDate.getTime() >= cutoff.getTime()
  }
  return product.listingKind === 'overseas_training' && product.noFutureDepartureConfirmedAt == null
}

describe('product-sales-policy visibility window', () => {
  it('splits 180d collection from 90d public display intent; Rule B = 3d', () => {
    expect(RULE_A_WINDOW_DAYS).toBe(180)
    expect(PUBLIC_DISPLAY_WINDOW_DAYS).toBe(90)
    expect(RULE_B_CUTOFF_DAYS).toBe(3)
  })

  it('last departure 2026-10-26: visible all KST day 10/23, hidden from 10/24 00:00 KST', () => {
    const product = { noFutureDepartureConfirmedAt: null, lastFutureDepartureDate: atUtcYmd('2026-10-26') }
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
      expect(publicProductWhereClause(now)).toEqual(expectedClause(atUtcYmd('2026-10-26')))
    }
    for (const now of hiddenInstants) {
      expect(isProductHiddenByPolicy(product, now)).toBe(true)
      expect(publicListingCutoffUtcDate(now)).toEqual(atUtcYmd('2026-10-27'))
      expect(publicProductWhereClause(now)).toEqual(expectedClause(atUtcYmd('2026-10-27')))
    }
  })

  it('boundary: on D-3 (last == cutoff YMD) still visible', () => {
    const product = { noFutureDepartureConfirmedAt: null, lastFutureDepartureDate: atUtcYmd('2026-10-26') }
    expect(isProductHiddenByPolicy(product, new Date('2026-10-23T12:00:00+09:00'))).toBe(false)
  })

  it('boundary: D-2 and later hide', () => {
    const product = { noFutureDepartureConfirmedAt: null, lastFutureDepartureDate: atUtcYmd('2026-10-26') }
    expect(isProductHiddenByPolicy(product, new Date('2026-10-24T00:00:00+09:00'))).toBe(true)
    expect(isProductHiddenByPolicy(product, new Date('2026-10-25T09:00:00+09:00'))).toBe(true)
    expect(isProductHiddenByPolicy(product, new Date('2026-10-26T09:00:00+09:00'))).toBe(true)
  })

  it('marked with no last future departure is hidden', () => {
    expect(
      isProductHiddenByPolicy(
        { noFutureDepartureConfirmedAt: atUtcYmd('2026-10-01'), lastFutureDepartureDate: null },
        new Date('2026-10-20T12:00:00+09:00'),
      ),
    ).toBe(true)
  })

  // REGRESSION-FREEZE[departure-cache-from-rows]: 여행 상품은 캐시 비면 비공개(fail-closed) — manifest
  it('travel product with empty cache and no marker is hidden (EPP0211: 캐시 비어 미판정으로 공개되던 사례)', () => {
    for (const listingKind of ['travel', 'air_hotel_free', 'private_trip', null, undefined]) {
      expect(
        isProductHiddenByPolicy(
          { noFutureDepartureConfirmedAt: null, lastFutureDepartureDate: null, listingKind },
          new Date('2026-11-14T12:00:00+09:00'),
        ),
      ).toBe(true)
    }
  })

  // REGRESSION-FREEZE[departure-cache-from-rows]: otr 예외 — manifest
  it('overseas_training (otr) with no cache and no marker stays visible; with marker or stale cache hidden', () => {
    const now = new Date('2026-11-14T12:00:00+09:00')
    expect(
      isProductHiddenByPolicy(
        { noFutureDepartureConfirmedAt: null, lastFutureDepartureDate: null, listingKind: 'overseas_training' },
        now,
      ),
    ).toBe(false)
    expect(
      isProductHiddenByPolicy(
        { noFutureDepartureConfirmedAt: atUtcYmd('2026-11-01'), lastFutureDepartureDate: null, listingKind: 'overseas_training' },
        now,
      ),
    ).toBe(true)
    expect(
      isProductHiddenByPolicy(
        { noFutureDepartureConfirmedAt: null, lastFutureDepartureDate: atUtcYmd('2026-11-15'), listingKind: 'overseas_training' },
        now,
      ),
    ).toBe(true)
  })

  it('otr exception appears only as an AND branch on listingKind in the shared where clause', () => {
    const clause = publicProductWhereClause(new Date('2026-11-14T12:00:00+09:00'))
    expect(clause).toEqual(expectedClause(atUtcYmd('2026-11-17')))
  })

  it('isProductHiddenByPolicy agrees with publicProductWhereClause semantics for every case', () => {
    const now = new Date('2026-11-14T12:00:00+09:00')
    const kinds: Array<string | null> = ['travel', 'overseas_training', 'air_hotel_free', null]
    const lasts: Array<Date | null> = [null, atUtcYmd('2026-11-16'), atUtcYmd('2026-11-17'), atUtcYmd('2027-03-17')]
    const markers: Array<Date | null> = [null, atUtcYmd('2026-11-01')]
    for (const listingKind of kinds) {
      for (const lastFutureDepartureDate of lasts) {
        for (const noFutureDepartureConfirmedAt of markers) {
          const product = { listingKind, lastFutureDepartureDate, noFutureDepartureConfirmedAt }
          expect(matchesPublicWhere(product, now)).toBe(!isProductHiddenByPolicy(product, now))
        }
      }
    }
  })
})