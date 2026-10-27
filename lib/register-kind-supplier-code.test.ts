// REGRESSION-FREEZE[register-kind-supplier-code]
import { describe, expect, it } from 'vitest'
import {
  inferHanatourRegisterFactProductKind,
  inferRegisterFactProductKindFromSupplierProductCode as k,
} from '@/lib/register-facts/product-kind'

describe('supplier product-code kind', () => {
  it('hanatour: P/K/G/X package, B airtel', () => {
    expect(k('hanatour', 'EEP133270124OZN')).toBe('package') // 동유럽 3국 9일
    expect(k('hanatour', 'AVP258261029TWD')).toBe('package') // 푸꾸옥 5일 NO옵션
    expect(k('hanatour', 'APK2562608067CA')).toBe('package')
    expect(k('hanatour', 'CAG173261016ZEC')).toBe('package')
    expect(k('hanatour', 'JOX71026111000F')).toBe('package')
    expect(k('hanatour', 'AAB261260706FDB')).toBe('air_hotel_free') // 방콕 자유여행
    expect(k('hanatour', 'PSB2252608017CA')).toBe('air_hotel_free')
  })
  it('modetour / kyowontour: P package, A airtel', () => {
    expect(k('modetour', 'JHA1234')).toBe('air_hotel_free')
    expect(k('modetour', 'AIP1234')).toBe('package')
    expect(k('kyowontour', 'ESP210260901KE01')).toBe('package') // 스페인 포르투갈 10일
    expect(k('kyowontour', 'ATA3702610127C01')).toBe('air_hotel_free') // 치앙마이 [자유여행]
  })
  it('unknown supplier / letter / code → null (keep existing logic)', () => {
    expect(k('ybtour', 'EEF5001-261026KE00')).toBeNull()
    expect(k('lottetour', 'E01A')).toBeNull()
    expect(k('naeiltour', '9JZZ1')).toBeNull()
    expect(k('modetour', '12345')).toBeNull()
    expect(k('hanatour', '')).toBeNull()
    expect(k('hanatour', 'ABQ123')).toBeNull()
  })
  it('hanatour facts kind: package code wins over airtel-like API flags', () => {
    const url = 'https://www.hanatour.com/trp/pkg/CHPPKG0101L0101?pkgCd=EEP133270124OZN'
    expect(inferHanatourRegisterFactProductKind({ frdmSchdDvCd: 'FS' } as never, url)).toBe('package')
  })
})
