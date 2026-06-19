import { describe, expect, it } from 'vitest'
import {
  isModetourSd1AutoUnpublishEligible,
  isModetourSd1NotFoundError,
  ModetourB2cApiError,
  modetourB2cBodyIndicatesSd1,
} from '@/lib/modetour-sd1-policy'

describe('modetourB2cBodyIndicatesSd1', () => {
  it('detects SD2 soft-not-found bodies', () => {
    const body = {
      errorMessages: [{ errorCode: '상품이 존재하지 않습니다. [SD2]' }],
      isOK: false,
    }
    expect(modetourB2cBodyIndicatesSd1(body, JSON.stringify(body))).toBe(true)
  })

  it('treats SD2 HTTP 400 as soft-not-found for E2E fallback', () => {
    const err = new ModetourB2cApiError(
      400,
      'https://b2c-api.modetour.com/Package/GetOtherDepartureDates?productNo=1',
      '{"errorMessages":[{"errorCode":"상품이 존재하지 않습니다. [SD2]"}]}',
      { errorMessages: [{ errorCode: '상품이 존재하지 않습니다. [SD2]' }] },
    )
    expect(isModetourSd1NotFoundError(err)).toBe(true)
  })
})

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

  it('allows auto-unpublish for travel packages after API+E2E collect failure even with stale DB', () => {
    expect(
      isModetourSd1AutoUnpublishEligible(
        { listingKind: 'travel', productType: 'travel' },
        { hasFuturePricedDeparture: true },
      ),
    ).toBe(true)
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
