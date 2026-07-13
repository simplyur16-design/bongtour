/**
 * REGRESSION-FREEZE[register-facts-fetch-resilience]
 */
import { describe, expect, it } from 'vitest'
import {
  preferYbtourFactScheduleDaysWithTmRoute,
  ybtourRegisterScheduleToFactDays,
} from '@/lib/register-facts/ybtour'
import { ybtourPrefetchScheduleHasRouteCoverage } from '@/lib/ybtour-register-api-parse'

describe('ybtour fact schedule TM route', () => {
  it('preferYbtourFactScheduleDaysWithTmRoute — trvInfo 빈 thin에 TM places 병합', () => {
    const thin = [
      { day: 1, places: [], hotels: ['호텔A'], meals: ['조식', '중식'], transportNote: null },
      { day: 2, places: [], hotels: [], meals: ['호텔식'], transportNote: null },
      { day: 3, places: [], hotels: [], meals: [], transportNote: null },
    ]
    const out = preferYbtourFactScheduleDaysWithTmRoute(thin, {
      scheduleDetail: [
        { dayNo: 1, accommNm: '호텔A', foodB: '조식', foodL: '중식', foodD: null },
        { dayNo: 2, accommNm: null, foodB: '호텔식', foodL: null, foodD: null },
        { dayNo: 3, accommNm: null, foodB: null, foodL: null, foodD: null },
      ],
      scheduleDetailTm: [
        { dayNo: 1, tmNo: 1, tmTitle: '푸꾸옥 공항 도착', tmContent: '' },
        { dayNo: 1, tmNo: 2, tmTitle: '딘까우 야시장', tmContent: '' },
        { dayNo: 2, tmNo: 1, tmTitle: '혼톰 케이블카', tmContent: '' },
        { dayNo: 2, tmNo: 2, tmTitle: '안또이 시장', tmContent: '' },
        { dayNo: 3, tmNo: 1, tmTitle: '인천 귀국', tmContent: '' },
      ],
    })
    expect(out[0]?.places.length).toBeGreaterThan(0)
    expect(out[1]?.places.length).toBeGreaterThan(0)
    expect(out[0]?.meals).toEqual(expect.arrayContaining(['조식', '중식']))
  })

  it('ybtourPrefetchScheduleHasRouteCoverage — 식사만 있고 route 없으면 false', () => {
    expect(
      ybtourPrefetchScheduleHasRouteCoverage([
        { day: 1, routeText: null },
        { day: 2, routeText: '' },
        { day: 3, routeText: null },
      ]),
    ).toBe(false)
  })

  it('ybtourPrefetchScheduleHasRouteCoverage — 중간일 route 있고 귀국만 비면 true', () => {
    expect(
      ybtourPrefetchScheduleHasRouteCoverage([
        { day: 1, routeText: '푸꾸옥 - 딘까우' },
        { day: 2, routeText: '혼톰 케이블카' },
        { day: 3, routeText: null },
      ]),
    ).toBe(true)
  })

  it('ybtourRegisterScheduleToFactDays — routeText 세그먼트 → places', () => {
    const facts = ybtourRegisterScheduleToFactDays([
      {
        day: 1,
        title: '딘까우',
        description: 'vibe',
        routeText: '푸꾸옥 - 딘까우 야시장',
        imageKeyword: '',
        breakfastText: '반미',
        lunchText: null,
        dinnerText: null,
        hotelText: null,
      },
    ])
    expect(facts[0]?.places).toEqual(['푸꾸옥', '딘까우 야시장'])
    expect(facts[0]?.meals).toEqual(['반미'])
  })
})
