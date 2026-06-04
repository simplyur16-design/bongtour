import { describe, expect, it } from 'vitest'
import {
  areFitDayImageKeywordsUniform,
  buildFitDayImageKeywordFallback,
  pickFitDayImageKeyword,
  type FitItineraryDayForKeyword,
} from '@/lib/fit-itinerary-pick-day-image-keyword'
import { mergeScheduleWithFitKeywords } from '@/lib/fit-itinerary-merge-schedule-keywords'

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

  it('derives distinct keywords from day summaries when activities lack English', () => {
    const day1: FitItineraryDayForKeyword = {
      dayNumber: 1,
      title: '도톤보리의 밤',
      summary: '저녁엔 도톤보리를 걸으며 야경을 즐겨 보세요. 가벼운 겉옷을 챙기시면 좋아요.',
      activities: [
        {
          order: 1,
          category: 'transport',
          title: '입국',
          description: '',
          location: '간사이 국제공항',
        },
      ],
    }
    const day2: FitItineraryDayForKeyword = {
      dayNumber: 2,
      title: '교토의 하루',
      summary: '오전엔 청수사 일대를 둘러보세요. 신발은 편한 것을 권합니다.',
      activities: [
        {
          order: 1,
          category: 'hotel',
          title: '체크아웃',
          description: '',
          location: '오사카 호텔',
        },
      ],
    }
    const kw1 = pickFitDayImageKeyword(day1, fallback)
    const kw2 = pickFitDayImageKeyword(day2, fallback)
    expect(kw1).not.toBe(kw2)
    expect(kw1.length).toBeGreaterThan(2)
    expect(kw2.length).toBeGreaterThan(2)
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

  it('keeps Nha Trang compound (not truncated to Nha)', () => {
    const day: FitItineraryDayForKeyword = {
      dayNumber: 1,
      title: '나트랑 도착',
      summary: '',
      activities: [
        {
          order: 2,
          category: 'attraction',
          title: '롱선사',
          description: '',
          location: '롱선사 (Long Son Pagoda)',
        },
      ],
    }
    const kw = pickFitDayImageKeyword(day, {
      cityNameKo: '나트랑',
      cityKey: 'nhatrang',
      productTitle: '나트랑 에어텔',
      primaryDestination: '나트랑',
      destination: '나트랑',
    })
    expect(kw).not.toBe('Nha')
    expect(kw.toLowerCase()).toMatch(/long son|nha trang/i)
  })
})

describe('mergeScheduleWithFitKeywords distinct', () => {
  const nhaFallback = {
    cityNameKo: '나트랑',
    cityKey: 'nhatrang',
    productTitle: '나트랑 3박 에어텔',
    primaryDestination: '나트랑',
    destination: '나트랑',
  }

  it('assigns different keywords per day from fit landmarks (나트랑 패턴)', () => {
    const fitDays: FitItineraryDayForKeyword[] = [
      {
        dayNumber: 1,
        title: '도착·해변',
        summary: '',
        activities: [
          {
            order: 2,
            category: 'attraction',
            title: '롱선사',
            description: '',
            location: '롱선사 (Long Son Pagoda)',
          },
        ],
      },
      {
        dayNumber: 2,
        title: '테마파크',
        summary: '',
        activities: [
          {
            order: 2,
            category: 'attraction',
            title: '빈원더스',
            description: '',
            location: '빈원더스 (VinWonders Nha Trang)',
          },
        ],
      },
      {
        dayNumber: 3,
        title: '유적',
        summary: '',
        activities: [
          {
            order: 2,
            category: 'attraction',
            title: '포나가르',
            description: '',
            location: '포나가르 사원 (Po Nagar Cham Towers)',
          },
        ],
      },
    ]
    const { dayKeywords } = mergeScheduleWithFitKeywords([], fitDays, nhaFallback)
    expect(areFitDayImageKeywordsUniform(dayKeywords)).toBe(false)
    const values = Object.values(dayKeywords)
    expect(new Set(values.map((v) => v.toLowerCase())).size).toBe(3)
    expect(values.some((v) => /po nagar/i.test(v))).toBe(true)
    expect(values.every((v) => v !== 'Nha')).toBe(true)
  })
})
