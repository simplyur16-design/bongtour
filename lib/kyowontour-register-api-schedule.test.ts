/**
 * REGRESSION-FREEZE[kyowontour-schedule-expression]
 */
import { describe, expect, it } from 'vitest'
import {
  applyKyowontourScheduleExpressionToRows,
  buildKyowontourScheduleRouteTextFromTabRows,
  kyowontourTabRowToRoutePlace,
} from './kyowontour-register-api-schedule'
import { CSP302_SCHEDULE_TAB2_DETAIL_FIXTURE } from './kyowontour-tour-event-tab-data'

describe('kyowontour schedule routeText a-b-c chain', () => {
  it('builds multi-segment routeText from tab rows in step order', () => {
    const rows = CSP302_SCHEDULE_TAB2_DETAIL_FIXTURE.schedule
    const day1 = buildKyowontourScheduleRouteTextFromTabRows(rows.filter((r) => r.day === 1))
    const day2 = buildKyowontourScheduleRouteTextFromTabRows(rows.filter((r) => r.day === 2))
    expect(day1).toBe('쿤밍')
    expect(day2).toBe('여강고성 - 대,소석림')
  })

  it('maps airport 직접입력 to city segment', () => {
    const place = kyowontourTabRowToRoutePlace({
      day: 1,
      step: 1,
      type: '직접입력',
      nameKo: '인천 국제공항 출발',
    })
    expect(place).toBe('인천')
  })

  it('applyKyowontourScheduleExpressionToRows keeps description as 2~3문장 (not routeText copy)', () => {
    const out = applyKyowontourScheduleExpressionToRows([
      {
        day: 1,
        title: '쿤밍',
        description: 'old',
        routeText: '인천 - 쿤밍',
        imageKeyword: '',
      },
    ])
    expect(out[0]?.routeText).toBe('쿤밍')
    expect(out[0]?.description).not.toBe('쿤밍')
    expect(out[0]?.description).toMatch(/쿤밍|도착|일정/)
  })
})
