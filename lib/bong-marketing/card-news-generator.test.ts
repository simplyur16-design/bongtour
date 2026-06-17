import { describe, it, expect } from 'vitest'
import {
  buildSlideCorrectionPrompt,
  enforceSlideCharLimits,
  truncateBodyNaturally,
  truncateHeadline,
  validateSlide,
} from '@/lib/bong-marketing/card-news-generator'

describe('validateSlide', () => {
  it('accepts headline up to 12 chars', () => {
    const r = validateSlide({
      slideNumber: 1,
      headline: '123456789012',
      subtitle: '콜로세움 황제 자리',
      body: '짧은 본문이에요.',
    })
    expect(r.headlineValid).toBe(true)
    expect(r.subtitleValid).toBe(true)
    expect(r.bodyValid).toBe(true)
  })

  it('rejects headline over 12 chars', () => {
    const r = validateSlide({
      slideNumber: 1,
      headline: '1234567890123',
      subtitle: null,
      body: null,
    })
    expect(r.headlineValid).toBe(false)
  })

  it('rejects subtitle over 15 chars', () => {
    const r = validateSlide({
      slideNumber: 2,
      headline: '짧은 후킹',
      subtitle: '1234567890123456',
      body: null,
    })
    expect(r.subtitleValid).toBe(false)
  })

  it('rejects body over 50 chars', () => {
    const r = validateSlide({
      slideNumber: 3,
      headline: '짧은 후킹',
      subtitle: null,
      body: '가'.repeat(51),
    })
    expect(r.bodyValid).toBe(false)
  })
})

describe('truncateBodyNaturally', () => {
  it('returns short body unchanged', () => {
    expect(truncateBodyNaturally('짧은 문장이에요.')).toBe('짧은 문장이에요.')
  })

  it('cuts at sentence boundary', () => {
    const body = '첫 문장입니다. 두 번째 문장은 너무 길어서 잘려야 해요.'
    const out = truncateBodyNaturally(body, 20)
    expect(out).toBe('첫 문장입니다.')
    expect(out.length).toBeLessThanOrEqual(20)
  })

  it('cuts at word boundary when no sentence end', () => {
    const body = '단어 단어 단어 단어 단어 단어 단어'
    const out = truncateBodyNaturally(body, 15)
    expect(out.endsWith('…')).toBe(true)
    expect(out.length).toBeLessThanOrEqual(15)
  })
})

describe('truncateHeadline', () => {
  it('truncates without ellipsis', () => {
    expect(truncateHeadline('1234567890123', 12)).toBe('123456789012')
  })
})

describe('enforceSlideCharLimits', () => {
  it('truncates fields to spec max with natural body cut', () => {
    const out = enforceSlideCharLimits({
      slideNumber: 1,
      slideRole: 'hook',
      headline: '1234567890123',
      subtitle: '123456789012345678',
      body: '첫 문장입니다. 두 번째 문장은 너무 깁니다.',
      pexelsKeyword: 'test',
    })
    expect(out.headline.length).toBe(12)
    expect(out.subtitle?.length).toBe(15)
    expect(out.body?.length).toBeLessThanOrEqual(50)
  })
})

describe('buildSlideCorrectionPrompt', () => {
  it('includes violation details', () => {
    const prompt = buildSlideCorrectionPrompt('base prompt', [
      {
        slideNumber: 1,
        headlineValid: false,
        subtitleValid: true,
        bodyValid: false,
      },
    ])
    expect(prompt).toContain('base prompt')
    expect(prompt).toContain('슬라이드 1')
    expect(prompt).toContain('헤드라인 12자 이내 X')
    expect(prompt).toContain('본문 50자 이내 X')
  })
})
