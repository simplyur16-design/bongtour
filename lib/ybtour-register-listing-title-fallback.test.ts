import { describe, expect, it } from 'vitest'
import { pickYbtourListingTitleFromPapiSources } from '@/lib/ybtour-api-departures'
import { mergeYbtourDeterministicFieldsFromPaste } from '@/lib/ybtour-paste-deterministic-patch-ybtour'
import { buildSupplierProductDisplayTitle } from '@/lib/supplier-product-title-display'
import type { RegisterParsed } from '@/lib/register-llm-schema-ybtour'

describe('pickYbtourListingTitleFromPapiSources', () => {
  it('prefers first-display evNm', () => {
    expect(
      pickYbtourListingTitleFromPapiSources({
        firstDisplayEvNm: '유럽 동유럽 9일 #노팁',
        byGoodsEvNmForSeed: '다른제목 8일 #해시',
      }),
    ).toBe('유럽 동유럽 9일 #노팁')
  })

  it('falls back to by-goods seed evNm when first-display empty', () => {
    expect(
      pickYbtourListingTitleFromPapiSources({
        firstDisplayEvNm: '',
        byGoodsEvNmForSeed: '내몽골 오르도스 4일 #TOP PICK',
        byGoodsAnyEvNm: '다른상품',
      }),
    ).toBe('내몽골 오르도스 4일 #TOP PICK')
  })

  it('skips stub 미지정', () => {
    expect(
      pickYbtourListingTitleFromPapiSources({
        firstDisplayEvNm: '미지정',
        byGoodsAnyEvNm: '홍콩 4일 #반나절자유',
      }),
    ).toBe('홍콩 4일 #반나절자유')
  })
})

describe('mergeYbtourDeterministicFieldsFromPaste title recovery', () => {
  it('recovers listing title when parsed title is stub', () => {
    const paste = [
      '상품번호 EKP3057',
      '내몽골(오르도스) 4일 #TOP PICK #노팁노옵션노쇼핑',
      '포함사항',
      '항공',
    ].join('\n')
    const parsed = {
      originSource: 'ybtour',
      title: '미지정',
      supplierListingTitleRaw: null,
    } as RegisterParsed
    const out = mergeYbtourDeterministicFieldsFromPaste(parsed, paste)
    expect(out.title).toContain('내몽골')
    expect(out.title).not.toBe('미지정')
    expect(
      buildSupplierProductDisplayTitle({
        verbatimOriginal: out.title,
        brandKey: 'ybtour',
      }),
    ).not.toBe('미입력')
  })
})
