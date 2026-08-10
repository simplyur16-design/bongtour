import { describe, expect, it } from 'vitest'
import {
  formatSimplyurPlanDisplay,
  formatSimplyurQosMbps,
} from '@/lib/simplyur/plan-display'
import type { ProductOption } from '@/lib/bongsim/recommend/product-option'

function opt(partial: Partial<ProductOption> & Pick<ProductOption, 'allowance_label' | 'plan_type'>): ProductOption {
  return {
    option_api_id: 't1',
    plan_name: 'test',
    days_raw: '5일',
    option_label: '',
    network_family: 'roaming',
    price_block: {},
    flags: {},
    ...partial,
  }
}

describe('formatSimplyurPlanDisplay unlimited hints', () => {
  it('labels 완전 무제한 as Full unlimited with heavy-use hint', () => {
    const d = formatSimplyurPlanDisplay(opt({ allowance_label: '완전 무제한', plan_type: 'unlimited' }), 'en')
    expect(d.dataLabel).toBe('Full unlimited')
    expect(d.dataHint).toMatch(/video|heavy|GB/i)
    expect(d.dataHint).not.toMatch(/policy-type/i)
  })

  it('distinguishes Korea Unlimited 1Mbps vs 3Mbps vs Full 5Mbps', () => {
    const u1 = formatSimplyurPlanDisplay(
      opt({ allowance_label: '무제한', plan_type: 'unlimited', qos_raw: '1Mbps' }),
      'en',
    )
    const u3 = formatSimplyurPlanDisplay(
      opt({ allowance_label: '무제한', plan_type: 'unlimited', qos_raw: '3Mbps' }),
      'en',
    )
    const full = formatSimplyurPlanDisplay(
      opt({ allowance_label: '완전 무제한', plan_type: 'unlimited', qos_raw: '5Mbps' }),
      'en',
    )
    expect(u1.dataLabel).toBe('Unlimited · up to 1 Mbps')
    expect(u3.dataLabel).toBe('Unlimited · up to 3 Mbps')
    expect(full.dataLabel).toBe('Full unlimited · up to 5 Mbps')
    expect(u1.dataHint).not.toEqual(u3.dataHint)
    expect(full.dataHint).toMatch(/5 Mbps/)
    expect(full.dataHint).toMatch(/GB|video|heavy/i)
  })

  it('labels 무제한 with qos as Unlimited · up to X Mbps', () => {
    const d = formatSimplyurPlanDisplay(
      opt({ allowance_label: '무제한', plan_type: 'unlimited', qos_raw: '5Mbps' }),
      'en',
    )
    expect(d.dataLabel).toBe('Unlimited · up to 5 Mbps')
    expect(d.dataHint).toMatch(/5 Mbps/)
    expect(d.dataHint).toMatch(/maps|chat|browsing/i)
  })

  it('labels 무제한 without qos with everyday-use hint', () => {
    const unlimited = formatSimplyurPlanDisplay(opt({ allowance_label: '무제한', plan_type: 'unlimited' }), 'en')
    const full = formatSimplyurPlanDisplay(opt({ allowance_label: '완전 무제한', plan_type: 'unlimited' }), 'en')
    expect(unlimited.dataLabel).toBe('Unlimited')
    expect(unlimited.dataHint).toBeTruthy()
    expect(unlimited.dataHint).not.toEqual(full.dataHint)
    expect(unlimited.dataHint).toMatch(/everyday|max speed/i)
  })

  it('omits dataHint for daily capped plans', () => {
    const d = formatSimplyurPlanDisplay(opt({ allowance_label: '500MB', plan_type: 'daily' }), 'en')
    expect(d.dataLabel).toBe('500 MB/day')
    expect(d.dataHint).toBeNull()
  })
})

describe('formatSimplyurQosMbps', () => {
  it('formats Mbps and kbps', () => {
    expect(formatSimplyurQosMbps('5Mbps')).toBe('5 Mbps')
    expect(formatSimplyurQosMbps('1000kbps')).toBe('1 Mbps')
  })
})
