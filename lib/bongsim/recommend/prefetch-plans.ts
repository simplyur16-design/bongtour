"use client";

import { normalizeProductsByCountryKey } from "@/lib/bongsim/recommend/products-by-country-client-key";

// REGRESSION-FREEZE[bongsim-by-country-slim-prefetch]: plans hover/click prefetch — manifest
/** URL·HTTP 캐시 버스팅 — 과거 500이 jp만 남고 타국이 비던 회귀 차단 */
export const BONGSIM_PLANS_CLIENT_CACHE_VER = "3";

const CACHE_TTL_MS = 120_000;
export const PLANS_CLIENT_TIMEOUT_MS = 20_000;

type PlansCacheEntry = { at: number; data: unknown };

const memory = new Map<string, PlansCacheEntry>();
const inflight = new Map<string, Promise<unknown | null>>();

function plansKey(country: string, days: number, codes: string[]): string {
  const c = country.trim().toLowerCase();
  const sorted = [...codes].map((x) => x.trim().toLowerCase()).filter(Boolean).sort();
  const codesPart = sorted.length ? sorted.join(",") : c;
  return `v${BONGSIM_PLANS_CLIENT_CACHE_VER}|${c}|${Math.max(1, Math.floor(days))}|${codesPart}`;
}

export function readPrefetchedPlans(country: string, days: number, codes: string[]): unknown | null {
  const key = plansKey(country, days, codes);
  const hit = memory.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    memory.delete(key);
    return null;
  }
  return hit.data;
}

export function clearPrefetchedPlans(): void {
  memory.clear();
  inflight.clear();
}

export function prefetchPlans(country: string, days: number, codes: string[]): void {
  void fetchPlans(country, days, codes).catch(() => {});
}

async function fetchPlansOnce(
  country: string,
  days: number,
  codes: string[],
  signal: AbortSignal,
): Promise<unknown | null> {
  const q = new URLSearchParams({
    country: country.trim().toLowerCase(),
    days: String(Math.max(1, Math.floor(days))),
    cv: BONGSIM_PLANS_CLIENT_CACHE_VER,
  });
  const sorted = [...codes].map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (sorted.length > 0) q.set("codes", sorted.join(","));
  const res = await fetch(`/api/bongsim/products/plans?${q.toString()}`, {
    signal,
    cache: "no-store",
  });
  if (!res.ok) return null;
  return await res.json();
}

export async function fetchPlans(
  country: string,
  days: number,
  codes: string[],
): Promise<unknown | null> {
  const key = plansKey(country, days, codes);
  if (!country.trim()) return null;

  const cached = readPrefetchedPlans(country, days, codes);
  if (cached) return cached;

  const pending = inflight.get(key);
  if (pending) return pending;

  const task = (async () => {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), PLANS_CLIENT_TIMEOUT_MS);
    try {
      let json = await fetchPlansOnce(country, days, codes, ctrl.signal);
      if (!json) {
        await new Promise((r) => window.setTimeout(r, 450));
        json = await fetchPlansOnce(country, days, codes, ctrl.signal);
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

export { normalizeProductsByCountryKey };
