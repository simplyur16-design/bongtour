import { describe, expect, it } from 'vitest'
import { resolveYbtourRegisterCollectUrl } from '@/lib/ybtour-api-departures'
import { resolveYbtourGoodsCdOnlyCollectUrl } from '@/lib/ybtour-register-collect-parse'

// REGRESSION-FREEZE[ybtour-register-collect-url-prefer-evcd]: evCd 유지 — manifest
describe('resolveYbtourRegisterCollectUrl', () => {
  it('keeps URL that already has evCd (no goodsCd rewrite)', () => {
    const url =
      'https://prdt.ybtour.co.kr/product/detailPackage?menu=FIT&dspSid=ABIB001&evCd=CIF1003-260707OZ00'
    expect(resolveYbtourRegisterCollectUrl(url, 'CIF1003')).toBe(url)
  })

  it('rewrites goodsCd-only URL for seed path', () => {
    const url = 'https://prdt.ybtour.co.kr/product/detailPackage?goodsCd=CIF1003'
    expect(resolveYbtourRegisterCollectUrl(url, 'CIF1003')).toBe(
      'https://prdt.ybtour.co.kr/product/detailPackage?goodsCd=CIF1003',
    )
  })

  it('builds goodsCd URL from originCode when URL has neither', () => {
    expect(resolveYbtourRegisterCollectUrl('https://prdt.ybtour.co.kr/product/detailPackage', 'NWP1002')).toBe(
      'https://prdt.ybtour.co.kr/product/detailPackage?goodsCd=NWP1002',
    )
  })
})

describe('resolveYbtourGoodsCdOnlyCollectUrl', () => {
  it('strips to goodsCd even when URL has past evCd', () => {
    const url =
      'https://prdt.ybtour.co.kr/product/detailPackage?menu=FIT&evCd=CIF1003-260707OZ00'
    expect(resolveYbtourGoodsCdOnlyCollectUrl(url, 'CIF1003')).toBe(
      'https://prdt.ybtour.co.kr/product/detailPackage?goodsCd=CIF1003',
    )
  })
})
