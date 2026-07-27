import type { ProductOption } from "@/lib/bongsim/recommend/product-option";
import { extractDaysFromDaysRaw } from "@/lib/bongsim/recommend/product-option";

/** 카탈로그에 실제 존재하는 `days_raw` 일수만 (중복 제거·오름차순). */
export function collectAvailableTripDays(products: ProductOption[]): number[] {
  const set = new Set<number>();
  for (const p of products) {
    const d = extractDaysFromDaysRaw(p.days_raw);
    if (d == null || !Number.isFinite(d) || d < 1) continue;
    set.add(d);
  }
  return [...set].sort((a, b) => a - b);
}

export type CountryProductPackLike = {
  roaming: { products: ProductOption[] };
  local: { products: ProductOption[] } | null;
  /** by-country lite 응답 — products 비어 있어도 일수 제공 */
  available_days?: number[];
};

export function collectTripDaysFromCountryPack(pack: CountryProductPackLike): number[] {
  if (Array.isArray(pack.available_days) && pack.available_days.length > 0) {
    return [...new Set(pack.available_days.filter((d) => Number.isFinite(d) && d >= 1))].sort(
      (a, b) => a - b,
    );
  }
  const all = [...pack.roaming.products];
  if (pack.local) all.push(...pack.local.products);
  return collectAvailableTripDays(all);
}
