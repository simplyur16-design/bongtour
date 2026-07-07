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
    }
  >;
  multi: unknown[];
};

const CACHE_TTL_MS = 120_000;

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
    const res = await fetch(`/api/bongsim/products/by-country?codes=${encodeURIComponent(key)}`);
    if (!res.ok) return null;
    const json = (await res.json()) as ProductsByCountryClientPayload;
    memory.set(key, { at: Date.now(), data: json });
    return json;
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, task);
  return task;
}
