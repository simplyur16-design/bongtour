import { describe, expect, it } from 'vitest'
import { auditRegisterFactBundleCompleteness } from '@/lib/register-facts/completeness'
import type { SupplierRegisterFactBundle } from '@/lib/register-facts/types'

function minimalBundle(
  overrides: Partial<SupplierRegisterFactBundle> = {},
): SupplierRegisterFactBundle {
  return {
    supplier: 'modetour',
    fetchedAt: new Date().toISOString(),
    originUrl: 'https://example.com/package/1',
    originCode: '1',
    title: '테스트 상품',
    nights: 3,
    days: 5,
    meetingInfo: null,
    includedBullets: ['항공'],
    excludedBullets: ['개인경비'],
    shoppingPlaces: [],
    scheduleDays: [{ day: 1, places: ['도쿄'], hotels: ['호텔'], meals: ['조식'], transportNote: null }],
    flights: [
      {
        direction: 'outbound',
        carrier: 'KE',
        flightNo: 'KE001',
        departureCity: '인천',
        departureAt: '2026-07-01',
        arrivalCity: '나리타',
        arrivalAt: '2026-07-01',
      },
    ],
    priceRows: [{ departureDate: '2026-07-01', adultPrice: 1000000, childPrice: null, infantPrice: null, supplierDepartureCode: '1' }],
    notes: [],
    ...overrides,
  }
}

describe('auditRegisterFactBundleCompleteness', () => {
  it('passes when all required axes are present', () => {
    const report = auditRegisterFactBundleCompleteness(minimalBundle())
    expect(report.ok).toBe(true)
    expect(report.missing).toEqual([])
  })

  it('flags missing schedule and flights', () => {
    const report = auditRegisterFactBundleCompleteness(
      minimalBundle({
        scheduleDays: [],
        flights: [],
      }),
    )
    expect(report.ok).toBe(false)
    expect(report.missing).toEqual(expect.arrayContaining(['scheduleDays', 'flights']))
  })

  it('allows empty schedule for air_hotel_free', () => {
    const report = auditRegisterFactBundleCompleteness(
      minimalBundle({
        notes: ['productKind=air_hotel_free'],
        scheduleDays: [],
      }),
    )
    expect(report.ok).toBe(true)
    expect(report.missing).not.toContain('scheduleDays')
  })
})
