import { describe, expect, it } from 'vitest'
import {
  modetourRegisterTitleBlocksConfirmSave,
  normalizeModetourRegisterTitleMinimal,
  resolveModetourRegisterProductTitle,
  resolveModetourRegisterProductTitleForConfirm,
} from '@/lib/modetour-register-product-title-ssot'

const GOOD =
  '[다낭] #바나힐 #호이안 #미케비치 #전신마사지 60분 #노쇼핑 #노옵션 3박 4일'
const BAD = '2026.12.12~2026.12.14 2박 3일'
const BAD_HOTEL = '일급호텔 3박 5일'

describe('modetour-register-product-title-ssot', () => {
  it('strips promo brackets like 출발확정 from api title', () => {
    expect(normalizeModetourRegisterTitleMinimal('[출발확정] 홍콩+마카오 2박4일')).toBe('홍콩+마카오 2박4일')
    const r = resolveModetourRegisterProductTitle({
      pasteBlob: '',
      llmTitleRaw: '[스테디셀러] 홍콩+마카오 핵심투어 2박4일',
    })
    expect(r.title).toBe('홍콩+마카오 핵심투어 2박4일')
  })

  it('resolver rejects departure window when no hash title in paste', () => {
    const r = resolveModetourRegisterProductTitle({
      pasteBlob: `${BAD}\n이스타항공`,
      llmTitleRaw: BAD,
    })
    expect(r.unacceptable).toBe(true)
  })

  it('resolver rejects hotel grade duration when llm returns it', () => {
    const r = resolveModetourRegisterProductTitle({
      pasteBlob: `${BAD_HOTEL}\n이스타항공`,
      llmTitleRaw: BAD_HOTEL,
    })
    expect(r.unacceptable).toBe(true)
  })

  it('confirm baseline overrides bad parsed title', () => {
    const r = resolveModetourRegisterProductTitleForConfirm({
      parsedTitle: BAD,
      baselineTrace: { pickedSource: 'h1.product_tit', raw: GOOD, cleaned: GOOD },
    })
    expect(r.title).toBe(GOOD)
    expect(r.unacceptable).toBe(false)
  })

  it('blocks confirm save without baseline', () => {
    expect(
      modetourRegisterTitleBlocksConfirmSave({
        prismaTitle: BAD,
        prismaOriginalTitle: BAD,
        baselineTrace: null,
      })
    ).toBe(true)
  })
})
