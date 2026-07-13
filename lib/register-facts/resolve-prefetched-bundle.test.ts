/**
 * REGRESSION-FREEZE[register-facts-fetch-resilience]
 */
import { describe, expect, it } from 'vitest'
import { coercePrefetchedRegisterFactBundle, resolvePrefetchedRegisterFactBundle } from '@/lib/register-facts/resolve-prefetched-bundle'
import type { SupplierRegisterFactBundle } from '@/lib/register-facts/types'

function sampleBundle(over: Partial<SupplierRegisterFactBundle> = {}): SupplierRegisterFactBundle {
  return {
    supplier: 'modetour',
    fetchedAt: '2026-07-13T00:00:00.000Z',
    originUrl: 'https://www.modetour.com/package/105896067',
    originCode: '105896067',
    title: '테스트',
    nights: 3,
    days: 4,
    meetingInfo: null,
    includedBullets: [],
    excludedBullets: [],
    shoppingPlaces: [],
    scheduleDays: [{ day: 1, places: ['오사카'], hotels: [], meals: [], transportNote: null }],
    flights: [],
    priceRows: [{ departureDate: '2026-08-01', adultPrice: 100000, childPrice: null, infantPrice: null, supplierDepartureCode: 'modetour:1' }],
    notes: ['price_collect=lite_only'],
    ...over,
  }
}

describe('coercePrefetchedRegisterFactBundle', () => {
  it('accepts structured bundle and rejects garbage', () => {
    expect(coercePrefetchedRegisterFactBundle(sampleBundle())).not.toBeNull()
    expect(coercePrefetchedRegisterFactBundle(null)).toBeNull()
    expect(coercePrefetchedRegisterFactBundle({ supplier: 'modetour' })).toBeNull()
  })
})

describe('resolvePrefetchedRegisterFactBundle', () => {
  it('returns bundle when supplier and originUrl match', () => {
    const b = sampleBundle()
    expect(
      resolvePrefetchedRegisterFactBundle(
        'https://www.modetour.com/package/105896067/',
        b,
        'modetour',
      ),
    ).toBe(b)
  })

  it('rejects wrong supplier or url', () => {
    const b = sampleBundle()
    expect(resolvePrefetchedRegisterFactBundle(b.originUrl, b, 'hanatour')).toBeNull()
    expect(
      resolvePrefetchedRegisterFactBundle('https://www.modetour.com/package/other', b, 'modetour'),
    ).toBeNull()
  })
})
