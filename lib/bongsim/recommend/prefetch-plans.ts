"use client";

import { normalizeProductsByCountryKey } from "@/lib/bongsim/recommend/products-by-country-client-key";

// REGRESSION-FREEZE[bongsim-by-country-slim-prefetch]: plans hover/click prefetch — manifest

const CACHE_TTL_MS = 120_000;
export const PLANS_CLIENT_TIMEOUT_MS = 20_000;

type PlansCacheEntry = { at: number; data: unknown };

const memory = new Map<string, PlansCacheEntry>();
const inflight = new Map<string, Promise<unknown | null>>();

function plansKey(country: string, days: number, codes: string[]): string {
  const c = country.trim().toLowerCase();
  const sorted = [...codes].map((x) => x.trim().toLowerCase()).filter(Boolean).sort();
  const codesPart = sorted.length ? sorted.join(",") : c;
  return `${c}|${Math.max(1, Math.floor(days))}|${codesPart}`;
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

export function prefetchPlans(country: string, days: number, codes: string[]): void {
  void fetchPlans(country, days, codes).catch(() => {});
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
      const q = new URLSearchParams({
        country: country.trim().toLowerCase(),
        days: String(Math.max(1, Math.floor(days))),
      });
      const sorted = [...codes].map((x) => x.trim().toLowerCase()).filter(Boolean);
      if (sorted.length > 0) q.set("codes", sorted.join(","));
      const res = await fetch(`/api/bongsim/products/plans?${q.toString()}`, {
        signal: ctrl.signal,
      });
      if (!res.ok) return null;
      const json = await res.json();
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
