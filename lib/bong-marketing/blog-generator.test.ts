import { describe, expect, it } from 'vitest'
import {
  buildBlogSystemPrompt,
  buildSeriesUserPrompt,
  finalizeBlogHashtags,
  parseBlogHashtags,
} from '@/lib/bong-marketing/blog-generator'

describe('parseBlogHashtags', () => {
  it('normalizes hashtag strings', () => {
    const tags = parseBlogHashtags(['봉투어', '#다낭', '  #여행  '])
    expect(tags[0]).toBe('#봉투어')
    expect(tags[1]).toBe('#다낭')
  })

  it('returns empty for invalid input', () => {
    expect(parseBlogHashtags(null)).toEqual([])
    expect(parseBlogHashtags('not-array')).toEqual([])
  })
})

describe('finalizeBlogHashtags', () => {
  it('ensures required tags and 20 count', () => {
    const tags = finalizeBlogHashtags(['#다낭', '#여행'])
    expect(tags[0]).toBe('#봉투어')
    expect(tags[1]).toBe('#Bong투어')
    expect(tags).toHaveLength(20)
  })
})

describe('buildBlogSystemPrompt', () => {
  it('8단락 구조와 여행 꿀팁·알아두면 좋은 점 단락 포함', () => {
    const prompt = buildBlogSystemPrompt('package', false)
    expect(prompt).toContain('8단락')
    expect(prompt).toContain('여행 꿀팁')
    expect(prompt).toContain('알아두면 좋은 점')
    expect(prompt).toContain('4000-5000자')
    expect(prompt).toContain('H2 헤딩 8개')
  })

  it('시리즈 통합 모드는 팁·주의 편 통합 지시 포함', () => {
    const prompt = buildBlogSystemPrompt('package', true)
    expect(prompt).toContain('시리즈의 여행팁 편')
    expect(prompt).toContain('시리즈의 주의사항 편')
  })
})

describe('buildSeriesUserPrompt', () => {
  it('팁·주의 편 슬라이드를 사용자 프롬프트에 포함', () => {
    const prompt = buildSeriesUserPrompt(
      {
        themeTitle: '여름 다낭',
        selectedCities: ['다낭'],
        tripNights: 4,
        tripDays: 5,
        season: 'summer',
      },
      [
        {
          episodeType: 'package',
          title: '다낭 패키지',
          slides: [{ headline: '비행기값 반값', body: '성수기 전에 가면 좋아요.' }],
        },
        {
          episodeType: 'tip',
          title: '다낭 여행팁',
          slides: [{ headline: '환전 팁', body: '공항보다 시내가 유리해요.' }],
        },
        {
          episodeType: 'caution',
          title: '다낭 주의사항',
          slides: [{ headline: '택시 주의', body: '미터기 확인하세요.' }],
        },
      ],
    )

    expect(prompt).toContain('[tip] 다낭 여행팁')
    expect(prompt).toContain('[caution] 다낭 주의사항')
    expect(prompt).toContain('환전 팁')
    expect(prompt).toContain('택시 주의')
    expect(prompt).toContain('5번 단락(여행 꿀팁)')
    expect(prompt).toContain('6번 단락(알아두면 좋은 점)')
  })
})
