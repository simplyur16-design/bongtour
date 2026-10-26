import { describe, expect, it } from 'vitest'
import {
  isExplicitNoShoppingSignal,
  reviewPolicyShoppingEmptyInfoLine,
} from '@/lib/review-policy-shopping-info'
import type { ShoppingStructured } from '@/lib/detail-body-parser-types'

function shop(partial: Partial<ShoppingStructured>): ShoppingStructured {
  return {
    rows: [],
    shoppingCountText: '',
    reviewNeeded: false,
    reviewReasons: [],
    ...partial,
  }
}

describe('review-policy-shopping-info', () => {
  it('no rows + no signal → 쇼핑 정보 없음(미확인)', () => {
    expect(reviewPolicyShoppingEmptyInfoLine(shop({}))).toBe('쇼핑 정보 없음(미확인)')
    expect(isExplicitNoShoppingSignal(shop({}))).toBe(false)
  })

  it('no rows + shoppingCountText 노쇼핑 → 쇼핑 없음', () => {
    expect(
      reviewPolicyShoppingEmptyInfoLine(shop({ shoppingCountText: '노쇼핑' })),
    ).toBe('쇼핑 없음')
  })

  it('no rows + reviewReasons 쇼핑 없음 → 쇼핑 없음', () => {
    expect(
      reviewPolicyShoppingEmptyInfoLine(shop({ reviewReasons: ['본문에 쇼핑 없음 표기'] })),
    ).toBe('쇼핑 없음')
  })

  it('has rows → empty info line', () => {
    expect(
      reviewPolicyShoppingEmptyInfoLine(
        shop({
          rows: [
            {
              shoppingItem: 'DFS',
              shoppingPlace: '시내',
              durationText: '',
              refundPolicyText: '',
            },
          ],
        }),
      ),
    ).toBe('')
  })
})
