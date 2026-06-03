import { describe, expect, it } from 'vitest'
import {
  buildFitDayImageKeywordFallback,
  pickFitDayImageKeyword,
  type FitItineraryDayForKeyword,
} from '@/lib/fit-itinerary-pick-day-image-keyword'

const fallback = {
  cityNameKo: '오사카',
  cityKey: 'osaka',
  productTitle: '오사카3일 에어텔',
  primaryDestination: '오사카',
  destination: '오사카',
}

describe('pickFitDayImageKeyword', () => {
  it('picks Dotonbori from day1 attraction location (fit-yb-0002 pattern)', () => {
    const day: FitItineraryDayForKeyword = {
      dayNumber: 1,
      title: '도심의 불빛',
      summary: '도톤보리',
      activities: [
        {
          order: 1,
          category: 'transport',
          title: '공항',
          description: '',
          location: '간사이 국제공항 (Kansai International Airport)',
        },
        {
          order: 3,
          category: 'meal',
          title: '도톤보리',
          description: '타코야키',
          location: '도톤보리 (Dotonbori)',
        },
      ],
    }
    expect(pickFitDayImageKeyword(day, fallback)).toBe('Dotonbori')
  })

  it('picks Kiyomizu from day2 attraction not USJ (fit-yb-0002 mismatch fix)', () => {
    const day: FitItineraryDayForKeyword = {
      dayNumber: 2,
      title: '교토',
      summary: '청수사',
      activities: [
        {
          order: 2,
          category: 'attraction',
          title: '청수사',
          description: '연인',
          location: '청수사 (Kiyomizu-dera Temple)',
        },
        {
          order: 4,
          category: 'shopping',
          title: '신사이바시',
          description: '',
          location: '신사이바시 (Shinsaibashi-suji)',
        },
      ],
    }
    const kw = pickFitDayImageKeyword(day, fallback)
    expect(kw).toBe('Kiyomizu-dera Temple')
    expect(kw).not.toMatch(/Universal Studios/i)
  })

  it('falls back to city when only transport/hotel', () => {
    const day: FitItineraryDayForKeyword = {
      dayNumber: 3,
      title: '귀국',
      summary: '',
      activities: [
        {
          order: 1,
          category: 'transport',
          title: '출국',
          description: '',
          location: '간사이 국제공항',
        },
      ],
    }
    const kw = pickFitDayImageKeyword(day, fallback)
    expect(kw.length).toBeGreaterThan(0)
    expect(buildFitDayImageKeywordFallback(fallback).length).toBeGreaterThan(0)
  })
})
