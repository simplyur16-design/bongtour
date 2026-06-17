import { describe, it, expect } from 'vitest'
import { parseHookExtractorResponse } from '@/lib/bong-marketing/hook-extractor'

describe('parseHookExtractorResponse', () => {
  it('parses valid hooks', () => {
    const result = parseHookExtractorResponse(
      {
        hooks: [
          {
            hookText: '30대 직장인 진짜 쉬는 4박 5일',
            hookType: 'good',
            category: 'package',
            tags: ['다낭'],
            reasoning: '숫자+공감',
          },
          {
            hookText: '함께 알아볼까요?',
            hookType: 'bad',
            category: 'etc',
            tags: [],
          },
        ],
      },
      '다낭 여행',
    )
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      hookText: '30대 직장인 진짜 쉬는 4박 5일',
      hookType: 'good',
      source: 'naver_blog_search',
      context: '네이버 블로그 검색: "다낭 여행"',
    })
    expect(result[1].hookType).toBe('bad')
  })

  it('filters empty hookText', () => {
    const result = parseHookExtractorResponse(
      { hooks: [{ hookText: '   ' }, { hookText: '유효한 후킹' }] },
      '키워드',
    )
    expect(result).toHaveLength(1)
    expect(result[0].hookText).toBe('유효한 후킹')
  })

  it('filters hookText longer than 50 chars', () => {
    const long = '가'.repeat(51)
    const result = parseHookExtractorResponse(
      { hooks: [{ hookText: long }, { hookText: '짧은 후킹' }] },
      '키워드',
    )
    expect(result).toHaveLength(1)
    expect(result[0].hookText).toBe('짧은 후킹')
  })

  it('throws on invalid response shape', () => {
    expect(() => parseHookExtractorResponse(null, 'k')).toThrow('응답 형식 오류')
    expect(() => parseHookExtractorResponse({ hooks: 'not-array' }, 'k')).toThrow('응답 형식 오류')
  })

  it('defaults unknown hookType to good', () => {
    const result = parseHookExtractorResponse({ hooks: [{ hookText: '테스트' }] }, 'k')
    expect(result[0].hookType).toBe('good')
  })
})
