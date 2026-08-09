import { describe, expect, it } from 'vitest';

import type { CountryPack, PlanProduct } from '@/src/api/simplyur';
import {
  SIMPLYUR_KOREA_DEFAULT_TRIP_DAYS,
  collectAvailableDays,
  filterProductsByDays,
  snapTripDaysToAvailable,
} from './plans-catalog';

function product(partial: Partial<PlanProduct> & Pick<PlanProduct, 'option_api_id' | 'days'>): PlanProduct {
  return {
    days_label: `${partial.days} day`,
    data_label: '1GB',
    plan_summary: 'test',
    simplyur_display: { formatted: '$1', currency: 'USD', amount: 1 },
    ...partial,
  };
}

describe('plans-catalog auto-select', () => {
  it('defaults Korea trip days to 5', () => {
    expect(SIMPLYUR_KOREA_DEFAULT_TRIP_DAYS).toBe(5);
  });

  it('snaps preferred day to nearest available', () => {
    expect(snapTripDaysToAvailable(5, [3, 5, 7])).toBe(5);
    expect(snapTripDaysToAvailable(4, [3, 5, 7])).toBe(3);
    expect(snapTripDaysToAvailable(10, [7, 15, 30])).toBe(7);
    expect(snapTripDaysToAvailable(5, [])).toBeNull();
  });

  it('collects and filters days from pack', () => {
    const pack: CountryPack = {
      roaming: {
        min_display: null,
        products: [product({ option_api_id: 'a', days: 5 }), product({ option_api_id: 'b', days: 7 })],
      },
      local: null,
    };
    expect(collectAvailableDays(pack)).toEqual([5, 7]);
    expect(filterProductsByDays(pack.roaming.products, 5)).toHaveLength(1);
  });
});
