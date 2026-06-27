import { describe, expect, it } from 'vitest'
import { inferCanonicalSupplierFromOriginUrl } from '@/lib/infer-supplier-from-origin-url'

describe('inferCanonicalSupplierFromOriginUrl', () => {
  it('maps known supplier hosts', () => {
    expect(
      inferCanonicalSupplierFromOriginUrl(
        'https://www.modetour.com/package/123',
      ),
    ).toBe('modetour')
    expect(
      inferCanonicalSupplierFromOriginUrl(
        'https://www.kyowontour.com/goods/goodsEventDetail?tourCode=x',
      ),
    ).toBe('kyowontour')
    expect(
      inferCanonicalSupplierFromOriginUrl(
        'https://www.naeiltour.co.kr/sub/view.asp?gotp=M&detail=M404&good_cd=MEZZ32069',
      ),
    ).toBe('naeiltour')
  })

  it('returns null for unknown host', () => {
    expect(inferCanonicalSupplierFromOriginUrl('https://example.com/p')).toBeNull()
  })
})
