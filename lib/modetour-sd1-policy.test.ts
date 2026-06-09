import { describe, expect, it } from 'vitest'
import { isModetourSd1AutoUnpublishEligible } from '@/lib/modetour-sd1-policy'

describe('isModetourSd1AutoUnpublishEligible', () => {
  it('allows auto-unpublish for travel packages', () => {
    expect(isModetourSd1AutoUnpublishEligible({ listingKind: 'travel', productType: 'travel' })).toBe(
      true,
    )
  })

  it('blocks SD1 auto-unpublish for air_hotel_free', () => {
    expect(
      isModetourSd1AutoUnpublishEligible({ listingKind: 'air_hotel_free', productType: 'air-hotel' }),
    ).toBe(false)
  })

  it('blocks SD1 auto-unpublish for legacy airtel productType', () => {
    expect(isModetourSd1AutoUnpublishEligible({ listingKind: 'travel', productType: 'airtel' })).toBe(
      false,
    )
  })

  it('blocks SD1 auto-unpublish for air-hotel productType without listingKind', () => {
    expect(isModetourSd1AutoUnpublishEligible({ listingKind: null, productType: 'air-hotel' })).toBe(
      false,
    )
  })

  it('blocks SD1 auto-unpublish when future priced departures remain in DB', () => {
    expect(
      isModetourSd1AutoUnpublishEligible(
        { listingKind: 'travel', productType: 'travel' },
        { hasFuturePricedDeparture: true },
      ),
    ).toBe(false)
  })

  it('allows SD1 auto-unpublish for travel packages with no future priced departures', () => {
    expect(
      isModetourSd1AutoUnpublishEligible(
        { listingKind: 'travel', productType: 'travel' },
        { hasFuturePricedDeparture: false },
      ),
    ).toBe(true)
  })
})
