/**
 * REGRESSION-FREEZE[kyowontour-tour-event-tab-opt-shop]
 */
import { describe, expect, it } from 'vitest'
import {
  needsKyowontourScheduleCollect,
  scheduleTabParsedToRegisterDays,
} from './kyowontour-register-schedule-collect'
import { CSP302_SCHEDULE_TAB2_DETAIL_FIXTURE, parseKyowontourScheduleTabDetail } from './kyowontour-tour-event-tab-data'
import type { RegisterParsed } from './register-llm-schema-kyowontour'

describe('kyowontour register schedule collect mapping', () => {
  it('needs collect when schedule empty and LLM extract not filled', () => {
    const parsed = { schedule: [] } as RegisterParsed
    expect(needsKyowontourScheduleCollect(parsed)).toBe(true)
    expect(needsKyowontourScheduleCollect({ ...parsed, kyowontourScheduleExtractFilled: true })).toBe(false)
    expect(
      needsKyowontourScheduleCollect({
        ...parsed,
        schedule: [{ day: 1, title: '쿤밍', description: '출발', imageKeyword: 'Kunming' }],
      }),
    ).toBe(true)
    expect(
      needsKyowontourScheduleCollect({
        ...parsed,
        kyowontourScheduleExtractFilled: true,
        schedule: [
          {
            day: 1,
            title: '쿤밍',
            description: '출발',
            imageKeyword: 'Kunming',
            breakfastText: '호텔식',
            lunchText: '현지식',
            dinnerText: '현지식',
            hotelText: '호텔A',
          },
        ],
      }),
    ).toBe(false)
  })

  it('maps goodsEvtTab_2 rows to RegisterScheduleDay[]', () => {
    const tab = parseKyowontourScheduleTabDetail(CSP302_SCHEDULE_TAB2_DETAIL_FIXTURE)
    const days = scheduleTabParsedToRegisterDays(tab)
    expect(days[0]?.breakfastText).toBeNull()
    expect(days[0]?.dinnerText).toBe('현지식(중식)')
    expect(days[0]?.routeText).toBe('인천 - 쿤밍')
    expect(days[0]?.description?.split('\n')[0]).toBe('인천 - 쿤밍')
    expect(days[1]?.breakfastText).toBe('호텔식')
    expect(days[1]?.routeText).toBe('여강고성 - 대,소석림')
    expect(days[1]?.routeText?.split(' - ').length).toBe(2)
    expect(days[1]?.description?.split('\n')[0]).toContain('여강고성')
  })
})
