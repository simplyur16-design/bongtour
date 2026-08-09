import type { CountryPack, PlanProduct } from '@/src/api/simplyur';

/**
 * Sync with lib/bongsim/recommend/default-trip-days.ts — Korea SimplyUR default.
 * REGRESSION-FREEZE[simplyur-mobile-plans-auto-select]: default 5 days + snap — manifest
 */
export const SIMPLYUR_KOREA_DEFAULT_TRIP_DAYS = 5;

export function productDays(product: Pick<PlanProduct, 'days' | 'days_label'>): number | null {
  if (typeof product.days === 'number' && Number.isFinite(product.days)) return product.days;
  const m = product.days_label.match(/(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

export function collectAvailableDays(pack: CountryPack): number[] {
  const all = [...pack.roaming.products, ...(pack.local?.products ?? [])];
  const set = new Set<number>();
  for (const p of all) {
    const d = productDays(p);
    if (d != null) set.add(d);
  }
  return [...set].sort((a, b) => a - b);
}

/** Nearest available day to preferred (web recommend SSOT). */
export function snapTripDaysToAvailable(preferred: number, available: number[]): number | null {
  if (!available.length) return null;
  const pref = Math.max(1, Math.floor(preferred));
  if (available.includes(pref)) return pref;
  return available.reduce((best, d) => (Math.abs(d - pref) < Math.abs(best - pref) ? d : best));
}

export function filterProductsByDays(products: PlanProduct[], days: number): PlanProduct[] {
  return products.filter((p) => productDays(p) === days);
}

export function minFormattedPrice(products: PlanProduct[]): string | null {
  let best: PlanProduct | null = null;
  for (const p of products) {
    const amt = p.simplyur_display?.amount;
    if (amt == null) continue;
    if (!best || (best.simplyur_display?.amount ?? Number.POSITIVE_INFINITY) > amt) best = p;
  }
  return best?.simplyur_display?.formatted ?? null;
}

export function formatPlanMessage(template: string, days: number): string {
  return template.replace(/\{N\}/g, String(days));
}
