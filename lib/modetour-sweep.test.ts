import { describe, expect, it } from 'vitest'
import { shouldModetourSweepRetireOnSd1 } from '@/lib/modetour-sweep'

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
})
