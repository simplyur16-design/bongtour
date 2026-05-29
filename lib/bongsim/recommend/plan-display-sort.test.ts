import { describe, expect, it } from 'vitest'
import { sortPlansForDisplayList } from '@/lib/bongsim/recommend/plan-display-sort'
import type { ProductOption } from '@/lib/bongsim/recommend/product-option'

function fixed(
  allowance_label: string,
  days_raw: string,
  id: string,
  price?: number,
): ProductOption {
  return {
    option_api_id: id,
    plan_name: '대만',
    network_family: 'local',
    plan_type: 'fixed',
    days_raw,
    allowance_label,
    option_label: '',
    price_block: {},
    flags: {},
    recommended_price: price,
  }
}

describe('plan-display-sort fixed SSOT', () => {
  it('종량제: 용량↑, 같은 용량이면 일수↑ (7<15<30)', () => {
    const plans = [
      fixed('2GB', '30일', '2g30'),
      fixed('1GB', '30일', '1g30'),
      fixed('2GB', '15일', '2g15'),
      fixed('1GB', '7일', '1g7'),
      fixed('3GB', '30일', '3g30'),
    ]
    const sorted = sortPlansForDisplayList(plans, 4, 'fixed')
    expect(sorted.map((p) => p.option_api_id)).toEqual([
      '1g7',
      '1g30',
      '2g15',
      '2g30',
      '3g30',
    ])
  })
})
