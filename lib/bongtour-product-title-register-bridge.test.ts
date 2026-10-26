import { describe, expect, it } from 'vitest'
import { productTitlePairForRegisterConfirm } from '@/lib/bongtour-product-title-register-bridge'
import { buildSupplierProductDisplayTitle } from '@/lib/supplier-product-title-display'

describe('productTitlePairForRegisterConfirm plan-b-v7 display-time-only', () => {
  const original =
    '[출발임박][한정특가][2030전용] 동유럽 3국 7일 #크리스마스마켓 #프라하시내호텔1박'

  it('registration saves original as Product.title (not cleaned)', () => {
    const pair = productTitlePairForRegisterConfirm(
      {},
      {
        parsedSupplierTitle: original,
        supplierListingTitleRaw: original,
        brandKey: 'hanatour',
      },
    )
    expect(pair.prismaOriginalTitle).toBe(original)
    expect(pair.prismaTitle).toBe(original)
    expect(pair.prismaTitle).not.toBe(
      buildSupplierProductDisplayTitle({
        verbatimOriginal: original,
        brandKey: 'hanatour',
      }),
    )
  })

  it('display cleaner still strips status/promo for exposure', () => {
    expect(
      buildSupplierProductDisplayTitle({
        verbatimOriginal: original,
        brandKey: 'hanatour',
      }),
    ).toBe('[2030전용] 동유럽 3국 7일 #크리스마스마켓 #프라하시내호텔1박')
  })
})
