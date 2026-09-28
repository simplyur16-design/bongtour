/**
 * REGRESSION-FREEZE[register-schedule-json-keep-hotel-meal]: 확정 JSON hotel·식사 — manifest
 */
import { describe, expect, it } from 'vitest'
import { buildRegisterProductScheduleJson } from '@/lib/build-register-product-schedule-json'
import { buildProductScheduleJsonForDb } from '@/lib/schedule-image-keyword-persist'

describe('register schedule json keeps hotel/meal', () => {
  it('persists hotelText and meal fields on confirm JSON', () => {
    const json = buildRegisterProductScheduleJson([
      {
        day: 1,
        title: '푸꾸옥',
        description: '도착',
        imageKeyword: 'Phu Quoc',
        hotelText: '인터컨티넨탈 푸꾸옥',
        breakfastText: '조식 뷔페',
        lunchText: null,
        dinnerText: '석식',
        mealSummaryText: '조식 뷔페 · 석식',
      },
    ])
    const rows = JSON.parse(json) as Array<Record<string, unknown>>
    expect(rows[0]?.hotelText).toBe('인터컨티넨탈 푸꾸옥')
    expect(rows[0]?.breakfastText).toBe('조식 뷔페')
    expect(rows[0]?.dinnerText).toBe('석식')
    expect(rows[0]?.mealSummaryText).toMatch(/조식/)
  })

  it('keeps hotel when mapExtra only adds unrelated keys', () => {
    const json = buildProductScheduleJsonForDb(
      [
        {
          day: 2,
          title: '시티',
          description: '관광',
          routeText: '시내',
          imageKeyword: 'City',
          hotelText: '시내 호텔',
          breakfastText: '조식',
        },
      ],
      () => ({ note: 'x' }),
    )
    const rows = JSON.parse(json) as Array<Record<string, unknown>>
    expect(rows[0]?.hotelText).toBe('시내 호텔')
    expect(rows[0]?.breakfastText).toBe('조식')
    expect(rows[0]?.note).toBe('x')
  })
})
