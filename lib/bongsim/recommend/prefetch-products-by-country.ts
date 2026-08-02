"use client";

import { normalizeProductsByCountryKey } from "@/lib/bongsim/recommend/products-by-country-client-key";

// REGRESSION-FREEZE[bongsim-by-country-slim-prefetch]: 국가 타일 hover prefetch — manifest
export const BONGSIM_BY_COUNTRY_CLIENT_CACHE_VER = "4";

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
  const key = `${BONGSIM_BY_COUNTRY_CLIENT_CACHE_VER}|${normalizeProductsByCountryKey(codes)}`;
  const hit = memory.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    memory.delete(key);
    return null;
  }
  return hit.data;
}

export function clearPrefetchedProductsByCountry(): void {
  memory.clear();
  inflight.clear();
}

/** hover/click — fire-and-forget */
export function prefetchProductsByCountry(codes: string[]): void {
  if (codes.length === 0) return;
  void fetchProductsByCountry(codes).catch(() => {});
}

async function fetchByCountryOnce(
  codesKey: string,
  signal: AbortSignal,
): Promise<ProductsByCountryClientPayload | null> {
  const q = new URLSearchParams({
    codes: codesKey,
    cv: BONGSIM_BY_COUNTRY_CLIENT_CACHE_VER,
  });
  const res = await fetch(`/api/bongsim/products/by-country?${q.toString()}`, {
    signal,
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as ProductsByCountryClientPayload;
}

export async function fetchProductsByCountry(
  codes: string[],
): Promise<ProductsByCountryClientPayload | null> {
  const codesKey = normalizeProductsByCountryKey(codes);
  if (!codesKey) return null;
  const key = `${BONGSIM_BY_COUNTRY_CLIENT_CACHE_VER}|${codesKey}`;

  const cached = readPrefetchedProductsByCountry(codes);
  if (cached) return cached;

  const pending = inflight.get(key);
  if (pending) return pending;

  const task = (async () => {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), PRODUCTS_BY_COUNTRY_CLIENT_TIMEOUT_MS);
    try {
      let json = await fetchByCountryOnce(codesKey, ctrl.signal);
      if (!json) {
        await new Promise((r) => window.setTimeout(r, 450));
        json = await fetchByCountryOnce(codesKey, ctrl.signal);
      }
      if (!json) return null;
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
