/**
 * REGRESSION-FREEZE[register-schedule-image-keyword-gemini-fill]
 */
import { describe, expect, it } from 'vitest'
import {
  buildScheduleImageKeywordGeminiPrompt,
  buildFreeLeisureDayGeminiPrompt,
  scheduleDaysMissingImageKeyword2AfterRules,
  scheduleDaysMissingImageKeywordAfterRules,
  scheduleFreeLeisureDaysMissingImageKeyword,
} from './register-schedule-image-keyword-gemini-fill'

describe('register-schedule-image-keyword-gemini-fill', () => {
  it('scheduleDaysMissingImageKeywordAfterRules — routeText만 있고 kw 비면 대상', () => {
    const days = scheduleDaysMissingImageKeywordAfterRules([
      { day: 1, routeText: '인천 - 북경', imageKeyword: 'Beijing' },
      { day: 2, routeText: '북경 - 천안문광장 - 자금성', imageKeyword: '' },
      { day: 3, title: '귀국', description: '', routeText: '', imageKeyword: '' },
    ])
    expect(days).toEqual([2])
  })

  it('scheduleDaysMissingImageKeyword2AfterRules — 관광·kw1만·route 2+세그먼트', () => {
    const rows = [
      { day: 1, routeText: '인천 - 북경', imageKeyword: 'Beijing', imageKeyword2: null },
      {
        day: 2,
        title: '2일차',
        routeText: '북경 - 천안문광장 - 자금성 - 십찰해',
        imageKeyword: 'Tiananmen Square',
        imageKeyword2: null,
      },
      {
        day: 3,
        routeText: '북경 - 이화원 - 만리장성',
        imageKeyword: 'Summer Palace',
        imageKeyword2: 'Great Wall of China',
      },
    ]
    expect(scheduleDaysMissingImageKeyword2AfterRules(rows)).toEqual([2])
  })

  it('scheduleFreeLeisureDaysMissingImageKeyword — 자유일정·kw 비면 대상', () => {
    const days = scheduleFreeLeisureDaysMissingImageKeyword([
      {
        day: 6,
        title: '[추천 프로그램] 야스아일랜드',
        description: '개별 자유일정',
        routeText: '야스아일랜드 - 씨월드 - 페라리 월드',
        imageKeyword: '',
      },
      { day: 2, routeText: '두바이 - 버즈 칼리파', imageKeyword: 'Burj Khalifa' },
    ])
    expect(days).toEqual([6])
  })

  it('buildFreeLeisureDayGeminiPrompt — 추천일정·dual-slot 규칙 포함', () => {
    const prompt = buildFreeLeisureDayGeminiPrompt(
      [{ day: 6, title: '자유일정', routeText: '야스아일랜드 - 씨월드', description: '개별 자유일정' }],
      { productDestination: 'UAE', productTitle: '두바이 6일', daysToFill: [6] },
    )
    expect(prompt).toMatch(/Free-leisure/)
    expect(prompt).toMatch(/recommendedRoute/)
    expect(prompt).toMatch(/imageKeyword2/)
  })

  it('buildScheduleImageKeywordGeminiPrompt — routeText 순서·dual-slot 규칙 포함', () => {
    const prompt = buildScheduleImageKeywordGeminiPrompt(
      [{ day: 2, routeText: '북경 - 천안문광장 - 자금성', title: '2일차' }],
      { productDestination: '중국', productTitle: '북경 4일', daysToFill: [2] },
    )
    expect(prompt).toMatch(/routeText="북경 - 천안문광장 - 자금성"/)
    expect(prompt).toMatch(/imageKeyword2/)
    expect(prompt).toMatch(/A - B - C/)
  })
})
