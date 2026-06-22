import { describe, expect, it } from 'vitest'
import {
  needsRegisterExcludedCollect,
  needsRegisterIncludedCollect,
  needsRegisterOptionalCollect,
  needsRegisterShoppingCollect,
} from '@/lib/register-detail-collect-gates'

describe('register-detail-collect-gates', () => {
  it('포함만 LLM 텍스트가 있어도 불포함은 수집 필요', () => {
    expect(
      needsRegisterIncludedCollect({
        includedItems: ['항공'],
        includedText: '항공',
      }),
    ).toBe(false)
    expect(
      needsRegisterExcludedCollect({
        includedItems: ['항공'],
        includedText: '항공',
      }),
    ).toBe(true)
  })

  it('optionalTourCount만 있어도 structured 없으면 선택관광 수집', () => {
    expect(
      needsRegisterOptionalCollect({
        hasOptionalPaste: false,
        optionalToursStructured: null,
        hasOptionalTour: true,
      }),
    ).toBe(true)
  })

  it('shoppingVisitCount만 있어도 structured 없으면 쇼핑 수집', () => {
    expect(
      needsRegisterShoppingCollect({
        hasShoppingPaste: false,
        shoppingStops: null,
      }),
    ).toBe(true)
  })
})
