import { describe, expect, it } from 'vitest'
import { formatSimplyurPlanDisplay } from '@/lib/simplyur/plan-display'
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
  it('labels 완전 무제한 as Full unlimited with policy hint', () => {
    const d = formatSimplyurPlanDisplay(opt({ allowance_label: '완전 무제한', plan_type: 'unlimited' }), 'en')
    expect(d.dataLabel).toBe('Full unlimited')
    expect(d.dataHint).toMatch(/fair use|policy/i)
  })

  it('labels 무제한 as Unlimited with distinct hint', () => {
    const unlimited = formatSimplyurPlanDisplay(opt({ allowance_label: '무제한', plan_type: 'unlimited' }), 'en')
    const full = formatSimplyurPlanDisplay(opt({ allowance_label: '완전 무제한', plan_type: 'unlimited' }), 'en')
    expect(unlimited.dataLabel).toBe('Unlimited')
    expect(unlimited.dataHint).toBeTruthy()
    expect(unlimited.dataHint).not.toEqual(full.dataHint)
  })

  it('omits dataHint for daily capped plans', () => {
    const d = formatSimplyurPlanDisplay(opt({ allowance_label: '500MB', plan_type: 'daily' }), 'en')
    expect(d.dataLabel).toBe('500 MB/day')
    expect(d.dataHint).toBeNull()
  })
})
