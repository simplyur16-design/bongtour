import { describe, expect, it } from 'vitest'
import {
  brandKeysToEnsure,
  resolveBrandKeyForOriginSource,
} from '@/lib/ensure-product-brand'

// REGRESSION-FREEZE[product-brand-ensure]: Brand 시드·상품 brandId — manifest
describe('ensure-product-brand', () => {
  it('includes all canonical overseas suppliers', () => {
    const keys = brandKeysToEnsure()
    expect(keys).toEqual(
      expect.arrayContaining([
        'hanatour',
        'modetour',
        'ybtour',
        'verygoodtour',
        'kyowontour',
        'lottetour',
        'naeiltour',
      ]),
    )
  })

  it('maps originSource tokens to brand keys', () => {
    expect(resolveBrandKeyForOriginSource('hanatour')).toBe('hanatour')
    expect(resolveBrandKeyForOriginSource('yellowballoon')).toBe('ybtour')
    expect(resolveBrandKeyForOriginSource('노랑풍선')).toBe('ybtour')
    expect(resolveBrandKeyForOriginSource('참좋은여행')).toBe('verygoodtour')
    expect(resolveBrandKeyForOriginSource('롯데관광')).toBe('lottetour')
    expect(resolveBrandKeyForOriginSource('내일투어')).toBe('naeiltour')
    expect(resolveBrandKeyForOriginSource('windsor')).toBe('windsor')
  })
})
