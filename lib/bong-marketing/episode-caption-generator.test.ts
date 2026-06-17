import { describe, it, expect } from 'vitest'
import { parseCaptionResponse } from '@/lib/bong-marketing/episode-caption-generator'

describe('parseCaptionResponse', () => {
  it('parses valid caption and hashtags with required tags', () => {
    const result = parseCaptionResponse({
      caption: '다낭 여행 팁 저장해두세요.',
      hashtags: ['#봉투어', '#Bong투어', '#다낭', '#여름여행', '#큐레이션여행'],
    })
    expect(result.caption).toBe('다낭 여행 팁 저장해두세요.')
    expect(result.hashtags).toHaveLength(5)
    expect(result.hashtags[0]).toBe('#봉투어')
    expect(result.hashtags[1]).toBe('#Bong투어')
  })

  it('adds missing required hashtags and pads to 5', () => {
    const result = parseCaptionResponse({
      caption: '테스트 캡션',
      hashtags: ['#다낭'],
    })
    expect(result.hashtags).toHaveLength(5)
    expect(result.hashtags[0]).toBe('#봉투어')
    expect(result.hashtags[1]).toBe('#Bong투어')
    expect(result.hashtags.every((t) => t.startsWith('#'))).toBe(true)
  })

  it('throws on missing caption', () => {
    expect(() => parseCaptionResponse({ hashtags: ['#봉투어'] })).toThrow(
      'Invalid caption generation response',
    )
  })
})
