"use client";

import { normalizeProductsByCountryKey } from "@/lib/bongsim/recommend/products-by-country-client-key";

// REGRESSION-FREEZE[bongsim-by-country-slim-prefetch]: 국가 타일 hover prefetch — manifest

export type ProductsByCountryClientPayload = {
  individual: Record<
    string,
    {
      roaming: { min_price: number; products: unknown[] };
      local: { min_price: number; products: unknown[] } | null;
      roaming_unlimited_min: number | null;
      local_unlimited_min: number | null;
      available_days?: number[];
    }
  >;
  multi: unknown[];
};

const CACHE_TTL_MS = 120_000;
/** 서버/풀 행 시 UI가 「상품 조회 중…」에 영원히 남지 않게 */
export const PRODUCTS_BY_COUNTRY_CLIENT_TIMEOUT_MS = 20_000;

const memory = new Map<string, { at: number; data: ProductsByCountryClientPayload }>();
const inflight = new Map<string, Promise<ProductsByCountryClientPayload | null>>();

export { normalizeProductsByCountryKey } from "@/lib/bongsim/recommend/products-by-country-client-key";

export function readPrefetchedProductsByCountry(
  codes: string[],
): ProductsByCountryClientPayload | null {
  const key = normalizeProductsByCountryKey(codes);
  const hit = memory.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    memory.delete(key);
    return null;
  }
  return hit.data;
}

/** hover/click — fire-and-forget */
export function prefetchProductsByCountry(codes: string[]): void {
  if (codes.length === 0) return;
  void fetchProductsByCountry(codes).catch(() => {});
}

export async function fetchProductsByCountry(
  codes: string[],
): Promise<ProductsByCountryClientPayload | null> {
  const key = normalizeProductsByCountryKey(codes);
  if (!key) return null;

  const cached = readPrefetchedProductsByCountry(codes);
  if (cached) return cached;

  const pending = inflight.get(key);
  if (pending) return pending;

  const task = (async () => {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), PRODUCTS_BY_COUNTRY_CLIENT_TIMEOUT_MS);
    try {
      const res = await fetch(`/api/bongsim/products/by-country?codes=${encodeURIComponent(key)}`, {
        signal: ctrl.signal,
      });
      if (!res.ok) return null;
      const json = (await res.json()) as ProductsByCountryClientPayload;
      memory.set(key, { at: Date.now(), data: json });
      return json;
    } catch {
      return null;
    } finally {
      window.clearTimeout(timer);
    }
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, task);
  return task;
}
