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

  it('정형칸 paste·LLM structured가 있어도 선택관광 API 수집 시도', () => {
    expect(
      needsRegisterOptionalCollect({
        hasOptionalPaste: true,
        optionalToursStructured: JSON.stringify([{ name: '옵션' }]),
        hasOptionalTour: true,
      }),
    ).toBe(true)
  })

  it('선택관광 없음 선언·hasOptionalTour false면 수집 스킵', () => {
    expect(
      needsRegisterOptionalCollect({
        hasOptionalPaste: false,
        optionalToursStructured: null,
        declaresNoOptional: true,
      }),
    ).toBe(false)
    expect(
      needsRegisterOptionalCollect({
        hasOptionalPaste: false,
        optionalToursStructured: null,
        hasOptionalTour: false,
      }),
    ).toBe(false)
  })

  it('정형칸 paste·shoppingStops JSON이 있어도 쇼핑 API 수집 시도', () => {
    expect(
      needsRegisterShoppingCollect({
        hasShoppingPaste: true,
        shoppingStops: JSON.stringify([{ itemName: '면세' }]),
      }),
    ).toBe(true)
  })
})
