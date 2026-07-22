/**
 * REGRESSION-FREEZE[register-schedule-sea-poi-kw]: 보홀·세부 한글 route → imageKeyword — manifest
 */
import { describe, expect, it } from 'vitest'
import { applyHanatourScheduleImageKeywordsToRows } from '@/lib/hanatour-schedule-image-keyword'
import { splitRouteTextPlaceSegments } from '@/lib/register-schedule-llm-image-keyword-fallback'

describe('register-schedule-sea-poi-kw', () => {
  it('normalizes CMS underscore compounds in route segments', () => {
    expect(splitRouteTextPlaceSegments('보홀_초콜릿힐 - 노스젠 밤부브릿지 선셋')).toEqual([
      '보홀 초콜릿힐',
      '노스젠 밤부브릿지 선셋',
    ])
  })

  it('maps Bohol 2030-style Korean routeText to English landmarks', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '1일차',
          description: '',
          routeText: null,
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 2,
          title: '노스젠',
          description: '',
          routeText: '노스젠 밤부브릿지 선셋 - 맹그로브_노스젠 밤부브릿지',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 4,
          title: 'ICM',
          description: '',
          routeText: '보홀 아일랜드 시티몰 - 보홀_초콜릿힐',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      {
        productDestination: '보홀',
        productTitle: '[2030전용] 보홀 5일 #헤난알로나비치',
      },
    )
    expect(String(out.find((r) => r.day === 2)?.imageKeyword ?? '')).toMatch(/Bamboo Bridge/i)
    expect(String(out.find((r) => r.day === 4)?.imageKeyword ?? '')).toMatch(/Chocolate Hills/i)
  })
})
