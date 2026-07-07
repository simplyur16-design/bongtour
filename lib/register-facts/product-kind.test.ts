import { describe, expect, it } from 'vitest'
import {
  inferHanatourRegisterFactProductKind,
  inferModetourRegisterFactProductKind,
  inferRegisterFactProductKindFromOriginUrl,
  parseRegisterFactProductKind,
  registerFactProductKindNote,
  resolveRegisterFactProductKindFromAdminTravelScope,
} from '@/lib/register-facts/product-kind'
import type { SupplierRegisterFactBundle } from '@/lib/register-facts/types'

describe('register-facts product kind', () => {
  it('detects ybtour FIT from URL', () => {
    expect(
      inferRegisterFactProductKindFromOriginUrl(
        'ybtour',
        'https://prdt.ybtour.co.kr/product/detailPackage?menu=FIT&evCd=CIF1003-260707OZ00',
      ),
    ).toBe('air_hotel_free')
  })

  it('detects modetour airtel from detail text', () => {
    expect(
      inferModetourRegisterFactProductKind({
        groupName: '[오사카 자유4일] 씨티루트 호텔급',
      }),
    ).toBe('air_hotel_free')
  })

  it('reads productKind note from bundle', () => {
    const bundle = {
      notes: [registerFactProductKindNote('air_hotel_free')],
    } as SupplierRegisterFactBundle
    expect(parseRegisterFactProductKind(bundle)).toBe('air_hotel_free')
  })

  it('detects hanatour airtel-like prod info', () => {
    expect(
      inferHanatourRegisterFactProductKind(
        { prodAttrCd: 'B', saleProdNm: '오사카 3박' } as never,
        'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=JMB331260701BXF',
      ),
    ).toBe('air_hotel_free')
  })

  it('admin travelScope overrides inferred product kind', () => {
    expect(
      resolveRegisterFactProductKindFromAdminTravelScope('air_hotel_free', 'package'),
    ).toBe('air_hotel_free')
    expect(
      resolveRegisterFactProductKindFromAdminTravelScope('overseas', 'air_hotel_free'),
    ).toBe('package')
    expect(resolveRegisterFactProductKindFromAdminTravelScope('', 'air_hotel_free')).toBe(
      'air_hotel_free',
    )
  })
})
