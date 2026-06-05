import { describe, expect, it } from 'vitest'
import {
  applyHanatourOriginCodeFromPaste,
  extractHanatourOriginCodeFromPaste,
} from '@/lib/hanatour-origin-code-from-paste'
import type { RegisterParsed } from '@/lib/register-llm-schema-hanatour'

describe('hanatour-origin-code-from-paste', () => {
  it('extracts PAB code glued to UI chrome (인쇄하기)', () => {
    const blob = '상품코드 PAB101260704JQ1인쇄하기 공유하기'
    expect(extractHanatourOriginCodeFromPaste(blob)).toBe('PAB101260704JQ1')
  })

  it('overrides LLM 미지정 when paste has 상품코드', () => {
    const parsed = { originCode: '미지정' } as RegisterParsed
    const out = applyHanatourOriginCodeFromPaste(parsed, '상품코드 PAB101260704JQ1인쇄하기')
    expect(out.originCode).toBe('PAB101260704JQ1')
  })

  it('does not override when originCode already set', () => {
    const parsed = { originCode: 'ATP207260601TWJ' } as RegisterParsed
    const out = applyHanatourOriginCodeFromPaste(parsed, '상품코드 PAB101260704JQ1')
    expect(out.originCode).toBe('ATP207260601TWJ')
  })
})
