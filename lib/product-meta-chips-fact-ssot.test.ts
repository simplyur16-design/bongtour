import { describe, expect, it } from 'vitest'
import { buildProductMetaChips } from '@/lib/product-meta-chips'
import { deriveOptionalFact, deriveShoppingFact, formatFactTriState } from '@/lib/supplier-product-fact-ssot'

describe('meta chips = deriveShoppingFact / deriveOptionalFact', () => {
  it('chip values match compare-table fact derives', () => {
    const product = {
      title: '다낭 5일 #노쇼핑 #노옵션',
      shoppingCount: null as number | null,
      shoppingVisitCountTotal: null as number | null,
      hasOptionalTours: null as boolean | null,
      shoppingItems: null,
      includedText: null,
      excludedText: null,
    }
    const shop = deriveShoppingFact(product)
    const opt = deriveOptionalFact(product)
    const chips = buildProductMetaChips(product)
    const shoppingChip = chips.find((c) => c.kind === 'shopping')
    const optionalChip = chips.find((c) => c.kind === 'optional')
    expect(shop.state).toBe('no')
    expect(opt.state).toBe('no')
    expect(shoppingChip?.value).toBe('없음')
    expect(optionalChip?.value).toBe('없음')
    expect(formatFactTriState(shop.state, shop.visitCount)).toBe('없음')
  })

  it('shopping N회 chip matches derive visitCount', () => {
    const product = {
      title: '상해 4일',
      shoppingCount: 2,
      shoppingVisitCountTotal: 2,
      hasOptionalTours: true,
    }
    const shop = deriveShoppingFact(product)
    const chips = buildProductMetaChips(product)
    expect(shop.visitCount).toBe(2)
    expect(chips.find((c) => c.kind === 'shopping')?.value).toBe('2회')
    expect(chips.find((c) => c.kind === 'optional')?.value).toBe('있음')
  })
})
