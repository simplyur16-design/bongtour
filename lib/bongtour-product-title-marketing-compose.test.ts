import { describe, expect, it } from 'vitest'
import {
  composeMarketingProductTitle,
  normalizeMarketingDurationToken,
  shouldPreferMarketingComposeOverLlm,
} from '@/lib/bongtour-product-title-marketing-compose'
import { titleHasDayCountToken, validateBongtourProductTitle } from '@/lib/bongtour-product-title-tone-ssot'

describe('normalizeMarketingDurationToken', () => {
  it('prefers structured duration over title', () => {
    expect(
      normalizeMarketingDurationToken('4박 5일', '다낭 5일'),
    ).toBe('4박 5일')
  })

  it('falls back to N박M일 in original title', () => {
    expect(normalizeMarketingDurationToken(null, '베트남 다낭·호이안 4박 5일')).toBe('4박 5일')
  })
})

describe('composeMarketingProductTitle', () => {
  it('keeps region, cities, and day count without perk keywords', () => {
    const title = composeMarketingProductTitle({
      originalProductTitle:
        '다낭·호이안 5일 [대한항공·인솔자 동행] 호이안 메모리즈쇼·임프레션 테마파크·미슐랭',
      destination: '다낭',
      duration: null,
    })
    expect(title).toMatch(/다낭/)
    expect(title).toMatch(/호이안/)
    expect(titleHasDayCountToken(title)).toBe(true)
    expect(title).not.toMatch(/미슐랭/)
    expect(validateBongtourProductTitle(title).ok).toBe(true)
  })

  it('composes multi-country region with duration', () => {
    const title = composeMarketingProductTitle({
      originalProductTitle:
        '코카서스 3국(조지아·아제르바이잔·아르메니아)+두바이 10일 [KE 대한항공·인솔자 동행]',
      destination: '두바이',
      duration: '10일',
    })
    expect(title).toMatch(/코카서스/)
    expect(title).toMatch(/10일/)
    expect(validateBongtourProductTitle(title).ok).toBe(true)
  })

  it('uses destination when cities are not split by ·', () => {
    const title = composeMarketingProductTitle({
      originalProductTitle: '호치민 프리미엄 5일 [KE 대한항공]',
      destination: '호치민',
      duration: '5일',
    })
    expect(title).toMatch(/호치민/)
    expect(title).toMatch(/5일/)
  })

  it('keeps one or two highlights from supplier brackets (not bare destination+duration)', () => {
    const title = composeMarketingProductTitle({
      originalProductTitle:
        "[KE][롯데관광'단독][NO쇼핑] 싱가포르 5일▶[하루자유][가든스바이더베이 2돔&버드 파라다이스]",
      destination: '싱가포르',
      duration: '3박 5일',
    })
    expect(title).toMatch(/싱가포르/)
    expect(title).toMatch(/하루자유|가든스바이더베이/)
    expect(title).toMatch(/3박\s*5일/)
    expect(title).not.toMatch(/^싱가포르 3박 5일$/)
  })
})

describe('shouldPreferMarketingComposeOverLlm', () => {
  it('detects over-shortened LLM title vs long supplier original', () => {
    const orig =
      '다낭·호이안 5일 [대한항공·인솔자 동행] 호이안 메모리즈쇼·임프레션 테마파크·미슐랭 특전'
    expect(shouldPreferMarketingComposeOverLlm('다낭 5일', orig, null)).toBe(true)
  })

  it('detects keyword-only chains after bracket', () => {
    const orig = '동유럽 3~4개국 9일 [노팁·노옵션]'
    expect(shouldPreferMarketingComposeOverLlm('[KE] 호이안·미슐랭·테마·파크', orig, '9일')).toBe(true)
  })
})
