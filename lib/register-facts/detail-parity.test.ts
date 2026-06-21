import { describe, expect, it } from 'vitest'
import { auditRegisterFactDetailParity } from '@/lib/register-facts/detail-parity'
import type { SupplierRegisterFactBundle } from '@/lib/register-facts/types'
import { registerFactProductKindNote } from '@/lib/register-facts/product-kind'

function minimalBundle(overrides: Partial<SupplierRegisterFactBundle> = {}): SupplierRegisterFactBundle {
  return {
    supplier: 'hanatour',
    fetchedAt: new Date().toISOString(),
    originUrl: 'https://example.com',
    originCode: 'PKG1',
    title: '테스트',
    nights: 3,
    days: 5,
    meetingInfo: null,
    includedBullets: ['항공', '호텔'],
    excludedBullets: ['개인경비'],
    shoppingPlaces: ['쇼핑 1'],
    scheduleDays: [{ day: 1, places: ['도쿄'], hotels: [], meals: [], transportNote: null }],
    flights: [{ direction: 'outbound', carrier: 'KE', flightNo: 'KE001', departureCity: '인천', departureAt: null, arrivalCity: null, arrivalAt: null }],
    priceRows: [{ departureDate: '2026-07-01', adultPrice: 1000000, childPrice: null, infantPrice: null, supplierDepartureCode: '1' }],
    notes: [],
    ...overrides,
  }
}

describe('auditRegisterFactDetailParity', () => {
  it('passes when register-facts matches detail-collect counts', () => {
    const bundle = minimalBundle()
    const report = auditRegisterFactDetailParity({
      bundle,
      detailScheduleDays: 1,
      detailIncludedCount: 2,
      detailExcludedCount: 1,
      detailShoppingCount: 1,
      detailFlightSignal: true,
      detailPriceRows: 1,
    })
    expect(report.ok).toBe(true)
    expect(report.mismatches).toEqual([])
  })

  it('skips scheduleDays error for air_hotel_free', () => {
    const bundle = minimalBundle({
      notes: [registerFactProductKindNote('air_hotel_free')],
      scheduleDays: [],
      includedBullets: ['항공+호텔'],
    })
    const report = auditRegisterFactDetailParity({
      bundle,
      detailScheduleDays: 0,
      detailIncludedCount: 1,
      detailExcludedCount: 1,
      detailShoppingCount: 0,
      detailFlightSignal: true,
      detailPriceRows: 1,
    })
    expect(report.productKind).toBe('air_hotel_free')
    expect(report.ok).toBe(true)
  })
})
