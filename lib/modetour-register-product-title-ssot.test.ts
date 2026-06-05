import { describe, expect, it } from 'vitest'
import {
  modetourRegisterTitleBlocksConfirmSave,
  resolveModetourRegisterProductTitle,
  resolveModetourRegisterProductTitleForConfirm,
} from '@/lib/modetour-register-product-title-ssot'

const GOOD =
  '[다낭] #바나힐 #호이안 #미케비치 #전신마사지 60분 #노쇼핑 #노옵션 3박 4일'
const BAD = '2026.12.12~2026.12.14 2박 3일'

describe('modetour-register-product-title-ssot', () => {
  it('resolver rejects departure window when no hash title in paste', () => {
    const r = resolveModetourRegisterProductTitle({
      pasteBlob: `${BAD}\n이스타항공`,
      llmTitleRaw: BAD,
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
