import { describe, expect, it } from 'vitest'
import { scheduleDayImageAiRightLabel, scheduleDayImageIsGenerated } from './schedule-day-image-ai-label-display'
import { getScheduleFromProduct } from './schedule-from-product'

describe('일차 사진 AI 표시(표시만)', () => {
  it('imageSource 기록으로 AI 판별', () => {
    expect(scheduleDayImageIsGenerated({ source: 'gemini', isGenerated: true, aiLabel: 'AI 생성 이미지' }, 'https://x/a.webp')).toBe(true)
    expect(scheduleDayImageIsGenerated({ source: 'photo-pool', isGenerated: true }, 'https://x/a.webp')).toBe(true)
    expect(scheduleDayImageIsGenerated('gemini', null)).toBe(true)
    expect(scheduleDayImageIsGenerated({ source: 'pexels', photographer: 'A' }, 'https://x/pexels_1.webp')).toBe(false)
    expect(scheduleDayImageIsGenerated(null, 'https://x/pexels_1.webp')).toBe(false)
  })
  it('우측 문구는 AI 일 때만', () => {
    expect(scheduleDayImageAiRightLabel(true)).toBe('AI 생성 이미지')
    expect(scheduleDayImageAiRightLabel(false)).toBeNull()
    expect(scheduleDayImageAiRightLabel(undefined)).toBeNull()
  })
  it('getScheduleFromProduct 가 imageIsGenerated 를 넘김', () => {
    const rows = getScheduleFromProduct({
      schedule: JSON.stringify([
        { day: 1, description: 'a', imageUrl: 'https://x/1.webp', imageSource: { source: 'gemini', isGenerated: true, aiLabel: 'AI 생성 이미지' } },
        { day: 2, description: 'b', imageUrl: 'https://x/2.webp', imageSource: { source: 'pexels', photographer: 'P' } },
      ]),
    } as never)
    expect(rows[0].imageIsGenerated).toBe(true)
    expect(rows[1].imageIsGenerated).toBe(false)
  })
})
