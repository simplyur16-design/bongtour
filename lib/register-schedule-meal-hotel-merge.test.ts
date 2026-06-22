import { describe, expect, it } from 'vitest'
import { mergeMissingKyowontourScheduleDays } from '@/lib/parse-and-register-kyowontour-schedule'
import type { RegisterParsed } from '@/lib/register-llm-schema-kyowontour'
import {
  mergeScheduleDaysPreservingExpressionMergingMealHotel,
  mergeScheduleMealHotelPatch,
  scheduleNeedsMealHotelCollect,
  scheduleRowLacksMealHotel,
} from '@/lib/register-schedule-meal-hotel-merge'

describe('mergeMissingKyowontourScheduleDays meal/hotel', () => {
  it('patches meals onto existing LLM day from pasted body', () => {
    const pasted = `1일차
2026.07.01(수)
식사
[조식] -
[중식] 기내식
[석식] 현지식
예정호텔
오키나와 리조트`
    const parsed = {
      schedule: [{ day: 1, title: '출발', description: '인천 출발', imageKeyword: 'Okinawa' }],
    } as RegisterParsed
    const out = mergeMissingKyowontourScheduleDays(parsed, pasted)
    expect(out.schedule?.[0]?.lunchText).toBe('기내식')
    expect(out.schedule?.[0]?.dinnerText).toBe('현지식')
    expect(out.schedule?.[0]?.hotelText).toContain('오키나와')
    expect(out.schedule?.[0]?.description).toBe('인천 출발')
  })
})


describe('register-schedule-meal-hotel-merge', () => {
  it('scheduleRowLacksMealHotel detects empty meal/hotel', () => {
    expect(scheduleRowLacksMealHotel({ day: 1 })).toBe(true)
    expect(
      scheduleRowLacksMealHotel({
        day: 1,
        breakfastText: '호텔식',
      }),
    ).toBe(false)
  })

  it('mergeScheduleMealHotelPatch fills only empty slots', () => {
    const merged = mergeScheduleMealHotelPatch(
      { day: 1, breakfastText: '기내식', hotelText: null },
      { breakfastText: '호텔식', lunchText: '현지식', hotelText: '리조트 A' },
    )
    expect(merged.breakfastText).toBe('기내식')
    expect(merged.lunchText).toBe('현지식')
    expect(merged.hotelText).toBe('리조트 A')
  })

  it('mergeScheduleDaysPreservingExpressionMergingMealHotel keeps LLM description', () => {
    const out = mergeScheduleDaysPreservingExpressionMergingMealHotel(
      [
        {
          day: 1,
          title: 'LLM 제목',
          description: 'LLM 상세 설명',
          imageKeyword: 'X',
        },
      ],
      [
        {
          day: 1,
          title: '탭 제목',
          description: '짧음',
          breakfastText: '호텔식',
          dinnerText: '현지식',
          hotelText: '오키나와 호텔',
        },
      ],
    )
    expect(out[0]?.description).toBe('LLM 상세 설명')
    expect(out[0]?.breakfastText).toBe('호텔식')
    expect(out[0]?.hotelText).toBe('오키나와 호텔')
  })

  it('scheduleNeedsMealHotelCollect when majority lacks meal/hotel', () => {
    expect(
      scheduleNeedsMealHotelCollect([
        { day: 1, breakfastText: '호텔식' },
        { day: 2 },
        { day: 3 },
      ]),
    ).toBe(true)
    expect(
      scheduleNeedsMealHotelCollect([
        { day: 1, breakfastText: 'a', lunchText: 'b', dinnerText: 'c', hotelText: 'h' },
        { day: 2, breakfastText: 'a', lunchText: 'b', dinnerText: 'c' },
      ]),
    ).toBe(false)
  })
})
