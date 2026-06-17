import { describe, it, expect } from 'vitest'
import {
  buildCardNewsSystemPrompt,
  buildCardNewsUserPrompt,
  expectedSlideRoles,
  type CardNewsPromptContext,
} from '@/lib/bong-marketing/card-news-prompt'

function baseCtx(overrides: Partial<CardNewsPromptContext> = {}): CardNewsPromptContext {
  return {
    themeTitle: '여름 몽골',
    selectedCities: ['울란바토르'],
    tripNights: 4,
    tripDays: 5,
    season: 'summer',
    operatorContext: {},
    episode: {
      episodeNumber: 1,
      episodeType: 'package',
      formatType: 'deep',
      title: '몽골 테를지',
      targetCity: '울란바토르',
      targetPlace: '테를지',
    },
    hookLibrary: { good: [], bad: [] },
    ...overrides,
  }
}

describe('buildCardNewsSystemPrompt', () => {
  it('핵심 룰(해요체·금지어·JSON·브랜드 가이드)을 포함한다', () => {
    const sys = buildCardNewsSystemPrompt()
    expect(sys).toContain('~해요체')
    expect(sys).toContain('12자 이내')
    expect(sys).toContain('최고')
    expect(sys).toContain('"slides"')
    expect(sys).toContain('정확히 5개')
    expect(sys).toContain('Bong투어')
    expect(sys).toContain('판매대행')
    expect(sys).toContain('가이드')
  })
})

describe('expectedSlideRoles', () => {
  it('package:deep 은 hook→...→cta 5장', () => {
    expect(expectedSlideRoles('package', 'deep')).toEqual([
      'hook',
      'background',
      'depth',
      'distinction',
      'cta',
    ])
  })
  it('package:list 는 명소 나열형', () => {
    expect(expectedSlideRoles('package', 'list')).toEqual(['hook', 'place1', 'place2', 'place3', 'cta'])
  })
  it('모든 조합이 5장 역할을 돌려준다', () => {
    for (const t of ['package', 'tip', 'caution'] as const) {
      for (const f of ['deep', 'list'] as const) {
        expect(expectedSlideRoles(t, f)).toHaveLength(5)
      }
    }
  })
})

describe('buildCardNewsUserPrompt', () => {
  it('시리즈·편 컨텍스트를 반영한다', () => {
    const out = buildCardNewsUserPrompt(baseCtx())
    expect(out).toContain('여름 몽골')
    expect(out).toContain('몽골 테를지')
    expect(out).toContain('테를지')
    expect(out).toContain('hook → background → depth → distinction → cta')
  })

  it('박/일·시즌을 반영한다', () => {
    const out = buildCardNewsUserPrompt(baseCtx())
    expect(out).toContain('4박 5일')
    expect(out).toContain('여름 시즌')
  })

  it('avoidTone 을 negative example 로 강조한다', () => {
    const out = buildCardNewsUserPrompt(
      baseCtx({ operatorContext: { avoidTone: '오글거리는 감탄사' } }),
    )
    expect(out).toContain('피해야 할 톤')
    expect(out).toContain('오글거리는 감탄사')
  })

  it('hotInfo 를 카피에 녹이도록 지시한다', () => {
    const out = buildCardNewsUserPrompt(
      baseCtx({ operatorContext: { hotInfo: '8월 나담 축제 시즌' } }),
    )
    expect(out).toContain('8월 나담 축제 시즌')
  })

  it('모범/금지 후킹을 few-shot 으로 주입한다', () => {
    const out = buildCardNewsUserPrompt(
      baseCtx({
        hookLibrary: {
          good: [{ hookText: '이 길은 지도에 없어요', context: '비밀 명소' }],
          bad: [{ hookText: '여러분 안녕하세요' }],
        },
      }),
    )
    expect(out).toContain('이 길은 지도에 없어요')
    expect(out).toContain('비밀 명소')
    expect(out).toContain('여러분 안녕하세요')
  })

  it('시즌 null 이면 themeIntent 로 계절 추론 안내', () => {
    const out = buildCardNewsUserPrompt(
      baseCtx({ season: null, operatorContext: { themeIntent: '초여름 휴양' } }),
    )
    expect(out).toContain('themeIntent')
    expect(out).toContain('초여름 휴양')
  })

  it('tip:list 는 팁 구조·카테고리 힌트를 포함한다', () => {
    const out = buildCardNewsUserPrompt(
      baseCtx({
        episode: {
          episodeNumber: 2,
          episodeType: 'tip',
          formatType: 'list',
          title: '다낭 여행팁',
          targetCity: '다낭',
        },
      }),
    )
    expect(out).toContain('tip · list')
    expect(out).toContain('짐 챙기기')
    expect(out).toContain('hook → tip1 → tip2 → tip3 → cta')
  })

  it('caution:list 는 주의사항 구조·톤 가이드를 포함한다', () => {
    const out = buildCardNewsUserPrompt(
      baseCtx({
        episode: {
          episodeNumber: 3,
          episodeType: 'caution',
          formatType: 'list',
          title: '다낭 주의사항',
          targetCity: '다낭',
        },
      }),
    )
    expect(out).toContain('caution · list')
    expect(out).toContain('공포 마케팅 X')
    expect(out).toContain('사기·바가지')
  })

  it('연결 상품은 맥락용으로만 표기한다', () => {
    const out = buildCardNewsUserPrompt(
      baseCtx({
        episode: {
          ...baseCtx().episode,
          linkedProduct: { id: 'p1', title: '몽골 5일', country: '몽골', city: '울란바토르' },
        },
      }),
    )
    expect(out).toContain('몽골 5일')
    expect(out).toContain('직접 노출 금지')
  })
})
