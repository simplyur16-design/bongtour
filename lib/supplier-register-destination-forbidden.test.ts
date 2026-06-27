/**
 * REGRESSION-FREEZE[lottetour-register-destination]
 */
import { describe, expect, it } from 'vitest'
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
  })
})

describe('supplier title promo badges — all suppliers', () => {
  it('strips 매진임박 and best brackets', () => {
    expect(normalizeSupplierRegisterListingTitle('[매진임박][best] 방콕 5일')).toBe('방콕 5일')
    expect(normalizeSupplierRegisterListingTitle('[출발확정] [BEST] 세부 4박5일')).toBe('세부 4박5일')
  })
})
