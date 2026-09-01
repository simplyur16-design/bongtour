/**
 * REGRESSION-FREEZE[lottetour-register-destination]
 */
import { describe, expect, it } from 'vitest'
import { extractHanatourTravelCitiesHintFromTitle } from '@/lib/hanatour-register-destination-from-paste'
import { isRegisterPrePhotoPlaceLikeDestination } from '@/lib/register-schedule-cross-continent-keyword-guard'
import { isSupplierRegisterDestinationUiLabel } from '@/lib/supplier-register-destination-forbidden'
import { normalizeSupplierRegisterListingTitle } from '@/lib/supplier-product-title-display'

describe('supplier register destination forbidden', () => {
  it('blocks UI section labels', () => {
    expect(isSupplierRegisterDestinationUiLabel('여행일정')).toBe(true)
    expect(isSupplierRegisterDestinationUiLabel('상품안내')).toBe(true)
    expect(isSupplierRegisterDestinationUiLabel('다낭')).toBe(false)
  })

  it('blocks promo badges as destination', () => {
    expect(isSupplierRegisterDestinationUiLabel('출발확정')).toBe(true)
    expect(isSupplierRegisterDestinationUiLabel('매진임박')).toBe(true)
    expect(isSupplierRegisterDestinationUiLabel('best')).toBe(true)
    expect(isSupplierRegisterDestinationUiLabel('판매마감')).toBe(true)
    expect(isSupplierRegisterDestinationUiLabel('단풍시즌')).toBe(true)
    expect(isSupplierRegisterDestinationUiLabel('판매마감 [비즈니스/클래스]')).toBe(true)
    expect(isSupplierRegisterDestinationUiLabel('[비즈니스/]')).toBe(true)
    expect(isSupplierRegisterDestinationUiLabel('[비즈니스]')).toBe(true)
  })
})

describe('supplier title promo badges — all suppliers', () => {
  it('strips 매진임박 and best brackets', () => {
    expect(normalizeSupplierRegisterListingTitle('[매진임박][best] 방콕 5일')).toBe('방콕 5일')
    expect(normalizeSupplierRegisterListingTitle('[출발확정] [BEST] 세부 4박5일')).toBe('세부 4박5일')
  })

  it('strips 판매마감 · 잔여좌석 · 단풍시즌 · 캐빈 뱃지', () => {
    expect(normalizeSupplierRegisterListingTitle('판매마감 [비즈니스/클래스] 캐나다 단풍시즌 10일')).toBe(
      '[비즈니스] 캐나다 10일',
    )
    expect(normalizeSupplierRegisterListingTitle('[비즈니스] 캐나다 10일')).toBe('[비즈니스] 캐나다 10일')
  })
})

describe('sale-status title must not become destination', () => {
  it('does not treat 판매마감/캐빈/단풍시즌 as a city', () => {
    expect(isRegisterPrePhotoPlaceLikeDestination('판매마감 [비즈니스/클래스]')).toBe(false)
    expect(isRegisterPrePhotoPlaceLikeDestination('[비즈니스]')).toBe(false)
    expect(isRegisterPrePhotoPlaceLikeDestination('단풍시즌')).toBe(false)
    expect(isRegisterPrePhotoPlaceLikeDestination('잔여좌석')).toBe(false)
    expect(extractHanatourTravelCitiesHintFromTitle('판매마감 [비즈니스/클래스] 캐나다 단풍시즌 10일')).toMatch(
      /캐나다/,
    )
    expect(extractHanatourTravelCitiesHintFromTitle('판매마감 [비즈니스/클래스] 캐나다 단풍시즌 10일')).not.toMatch(
      /비즈니스|단풍|판매/,
    )
  })
})
