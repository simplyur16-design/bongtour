/**
 * REGRESSION-FREEZE[register-travel-scope-origin-url-fit]
 */
import { describe, expect, it } from 'vitest'
import { resolveRegisterTravelScopeFromRequest } from '@/lib/register-admin-travel-category'

describe('resolveRegisterTravelScopeFromRequest', () => {
  it('ybtour menu=FIT URL overrides default overseas', () => {
    expect(
      resolveRegisterTravelScopeFromRequest({
        bodyTravelScope: 'overseas',
        originSource: 'ybtour',
        originUrl:
          'https://prdt.ybtour.co.kr/product/detailPackage?menu=FIT&dspSid=ABIB001&evCd=CIF1003-260707OZ00',
      }),
    ).toBe('air_hotel_free')
  })

  it('keeps explicit air_hotel_free and maps legacy domestic to overseas', () => {
    expect(
      resolveRegisterTravelScopeFromRequest({
        bodyTravelScope: 'air_hotel_free',
        originSource: 'ybtour',
        originUrl: 'https://prdt.ybtour.co.kr/product/detailPackage?menu=PKG&evCd=X',
      }),
    ).toBe('air_hotel_free')
    expect(
      resolveRegisterTravelScopeFromRequest({
        bodyTravelScope: 'domestic',
        originSource: 'modetour',
        originUrl: 'https://www.modetour.com/package/1',
      }),
    ).toBe('overseas')
  })

  it('title #자유여행 #에어텔 hint upgrades overseas', () => {
    expect(
      resolveRegisterTravelScopeFromRequest({
        bodyTravelScope: 'overseas',
        originSource: 'modetour',
        originUrl: null,
        listingTitleHint: '대만4일 #에어텔 #시내4성호텔 #자유여행',
      }),
    ).toBe('air_hotel_free')
  })
})
