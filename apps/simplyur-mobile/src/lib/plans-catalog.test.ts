import { describe, expect, it } from 'vitest';

import type { CountryPack, PlanProduct } from '@/src/api/simplyur';
import {
  SIMPLYUR_KOREA_DEFAULT_TRIP_DAYS,
  collectAvailableDays,
  filterProductsByDays,
  formatPlanCount,
  resolvePlanDataHint,
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

  it('resolves unlimited hints from data_label when API hint missing', () => {
    const t = (k: string) => k;
    expect(
      resolvePlanDataHint({ data_label: 'Full unlimited', data_hint: null }, t),
    ).toBe('recommend.fullUnlimitedHint');
    expect(resolvePlanDataHint({ data_label: 'Unlimited', data_hint: null }, t)).toBe(
      'recommend.unlimitedHint',
    );
    expect(
      resolvePlanDataHint({ data_label: 'Unlimited · up to 5 Mbps', data_hint: null }, t),
    ).toBe('recommend.unlimitedHint');
    expect(resolvePlanDataHint({ data_label: '500 MB/day', data_hint: null }, t)).toBeNull();
    expect(
      resolvePlanDataHint({ data_label: 'Unlimited', data_hint: 'from api' }, t),
    ).toBe('from api');
  });
});

describe('formatPlanCount', () => {
  const en: Record<string, string> = {
    'recommend.durationChip': '{N} days',
    'recommend.durationChipOne': '1 day',
  };
  const ja: Record<string, string> = { 'recommend.durationChip': '{N}日間' };
  const tFor = (m: Record<string, string>) => (k: string) => m[k] ?? k;

  it('uses the singular template for 1 when the locale has one', () => {
    expect(formatPlanCount(tFor(en), 'recommend.durationChip', 1)).toBe('1 day');
    expect(formatPlanCount(tFor(en), 'recommend.durationChip', 5)).toBe('5 days');
  });

  it('falls back to the plural template when no singular key exists', () => {
    expect(formatPlanCount(tFor(ja), 'recommend.durationChip', 1)).toBe('1日間');
  });
});
