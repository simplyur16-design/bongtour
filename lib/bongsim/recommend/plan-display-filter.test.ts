import { describe, expect, it } from 'vitest'
import {
  catalogDayOf,
  filterByTripDaysWindow,
  filterPlanGroupsByTripDaysWindow,
  isWithinTripDaysWindow,
} from '@/lib/bongsim/recommend/plan-display-filter'
import type { ProductOption } from '@/lib/bongsim/recommend/product-option'

function plan(days_raw: string, id = 'x'): ProductOption {
  return {
    option_api_id: id,
    plan_name: '대만',
    network_family: 'local',
    plan_type: 'unlimited',
    days_raw,
    allowance_label: '무제한',
    option_label: '',
    price_block: {},
    flags: {},
  }
}

describe('plan-display-filter ±2 window SSOT', () => {
  it('4일 여행 → 2~6일만 통과, 30일 제외', () => {
    const plans = [
      plan('2일', 'd2'),
      plan('3일', 'd3'),
      plan('4일', 'd4'),
      plan('6일', 'd6'),
      plan('7일', 'd7'),
      plan('30일', 'd30'),
    ]
    const out = filterByTripDaysWindow(plans, 4)
    expect(out.map((p) => catalogDayOf(p))).toEqual([2, 3, 4, 6])
    expect(out.some((p) => p.option_api_id === 'd30')).toBe(false)
    expect(out.some((p) => p.option_api_id === 'd7')).toBe(false)
  })

  it('isWithinTripDaysWindow 경계 ±2', () => {
    expect(isWithinTripDaysWindow(plan('2일'), 4)).toBe(true)
    expect(isWithinTripDaysWindow(plan('6일'), 4)).toBe(true)
    expect(isWithinTripDaysWindow(plan('1일'), 4)).toBe(false)
    expect(isWithinTripDaysWindow(plan('7일'), 4)).toBe(false)
  })

  it('filterPlanGroupsByTripDaysWindow — unlimited/daily/fixed 동일 적용', () => {
    const groups = filterPlanGroupsByTripDaysWindow(
      {
        unlimited: [plan('30일', 'u30'), plan('4일', 'u4')],
        daily: [plan('30일', 'd30'), plan('5일', 'd5')],
        fixed: [plan('15일', 'f15')],
      },
      4,
    )
    expect(groups.unlimited.map((p) => p.option_api_id)).toEqual(['u4'])
    expect(groups.daily.map((p) => p.option_api_id)).toEqual(['d5'])
    expect(groups.fixed).toHaveLength(0)
  })
})
