import { describe, expect, it } from 'vitest'
import {
  buildSupplierProductDisplayTitle,
  resolveSupplierVerbatimOriginalTitle,
  stripSupplierTitleUiNoise,
} from '@/lib/supplier-product-title-display'

describe('resolveSupplierVerbatimOriginalTitle', () => {
  it('prefers supplierListingTitleRaw when long enough', () => {
    expect(
      resolveSupplierVerbatimOriginalTitle({
        parsedSupplierTitle: '짧음',
        supplierListingTitleRaw: '코카서스 3국 10일 KE #두바이관광',
      }),
    ).toBe('코카서스 3국 10일 KE #두바이관광')
  })
})

describe('buildSupplierProductDisplayTitle', () => {
  it('keeps hashtags and bracket tags, strips UI noise only', () => {
    const title = buildSupplierProductDisplayTitle({
      verbatimOriginal: '★[동유럽] 체코·헝가리 9일 #노팁노옵션 #일급호텔',
      brandKey: 'hanatour',
    })
    expect(title).toContain('[동유럽]')
    expect(title).toContain('#노팁노옵션')
    expect(title).not.toContain('★')
  })

  it('does not collapse to city+duration marketing compose', () => {
    const original =
      '다낭·호이안 5일 [대한항공·인솔자 동행] 호이안 메모리즈쇼·임프레션·미슐랭'
    const title = buildSupplierProductDisplayTitle({
      verbatimOriginal: original,
      brandKey: 'ybtour',
    })
    expect(title).toMatch(/다낭/)
    expect(title).toMatch(/호이안/)
    expect(title).toMatch(/대한항공|인솔/)
    expect(title).not.toBe('다낭·호이안 4박 5일')
  })

  it('rejects departure window title for all suppliers', () => {
    expect(
      resolveSupplierVerbatimOriginalTitle({
        parsedSupplierTitle: '2026.06.15 ~ 2026.06.17 2박 3일',
        supplierListingTitleRaw: '2026.06.15 ~ 2026.06.17 2박 3일',
        brandKey: 'hanatour',
      }),
    ).toBe('미입력')
    expect(
      buildSupplierProductDisplayTitle({
        verbatimOriginal: '미입력',
        parsedSupplierTitle: '2026.06.15 ~ 2026.06.17 2박 3일',
        brandKey: 'ybtour',
      }),
    ).toBe('미입력')
  })

  it('rejects modetour hotel-grade-only display and falls back to parsed', () => {
    const title = buildSupplierProductDisplayTitle({
      verbatimOriginal: '일급호텔 3박 5일',
      parsedSupplierTitle: '[태국] 방콕·파타야 5일 #노옵션',
      brandKey: 'modetour',
    })
    expect(title).toContain('방콕')
    expect(title).toContain('#노옵션')
  })
})

describe('stripSupplierTitleUiNoise', () => {
  it('normalizes whitespace', () => {
    expect(stripSupplierTitleUiNoise('  다낭   5일  ')).toBe('다낭 5일')
  })
})
