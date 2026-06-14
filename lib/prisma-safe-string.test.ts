import { describe, expect, it } from 'vitest'
import {
  sanitizePrismaWriteData,
  stripLoneUtf16Surrogates,
  truncatePrismaSafeString,
} from '@/lib/prisma-safe-string'

describe('prisma-safe-string', () => {
  it('removes lone high surrogate', () => {
    const broken = `hello${String.fromCharCode(0xd83d)}world`
    expect(stripLoneUtf16Surrogates(broken)).toBe('helloworld')
  })

  it('keeps valid emoji surrogate pairs', () => {
    const ok = '푸꾸옥 🚠 케이블카 1️⃣ 2️⃣ 💡'
    expect(stripLoneUtf16Surrogates(ok)).toBe(ok)
  })

  it('truncates without splitting emoji', () => {
    const text = 'abc🚠def'
    const truncated = truncatePrismaSafeString(text, 4)
    expect(truncated).toBe('abc🚠')
    expect(stripLoneUtf16Surrogates(truncated)).toBe(truncated)
  })

  it('sanitizes nested product write payload strings', () => {
    const broken = String.fromCharCode(0xd83d)
    const data = {
      title: '정상',
      schedule: `[{"description":"포인트${broken}"}]`,
      tags: ['ok', broken],
    }
    const sanitized = sanitizePrismaWriteData(data)
    expect(sanitized.schedule).not.toContain(broken)
    expect(sanitized.tags[1]).toBe('')
  })
})
