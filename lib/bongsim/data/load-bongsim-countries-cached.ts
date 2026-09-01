import { unstable_cache } from "next/cache";
import {
  loadBongsimCountriesPayload,
  type BongsimCountryListItem,
} from "@/lib/bongsim/data/load-recommend-bootstrap";
import type { CountryCatalogMeta } from "@/lib/bongsim/data/list-country-catalog-meta";

export const BONGSIM_COUNTRIES_REVALIDATE_SEC = 120;

export type BongsimCountriesCachedResult =
  | { ok: true; countries: BongsimCountryListItem[]; catalogMeta: Record<string, CountryCatalogMeta> }
  | { ok: false; reason: "db_unconfigured" | "db_error" | "connection_timeout" };

// REGRESSION-FREEZE[bongsim-catalog-list-perf]: countries 실패 결과 캐시 금지 — manifest
// REGRESSION-FREEZE[esim-fulfill-keep-catalog-pipe]: last-good countries on miss — manifest

type CountriesOk = Extract<BongsimCountriesCachedResult, { ok: true }>;

let lastGoodCountries: CountriesOk | null = null;

async function fetchCountriesOrThrow(): Promise<CountriesOk> {
  const res = await loadBongsimCountriesPayload();
  if (!res.ok) throw new Error(`bongsim_countries_${res.reason}`);
  return res;
}

/** countries API 전용 — heroMap(Prisma) 없이 카탈로그만 (bootstrap 전체보다 가벼움) */
export async function loadBongsimCountriesPayloadCached(): Promise<BongsimCountriesCachedResult> {
  try {
    const res = await unstable_cache(fetchCountriesOrThrow, ["bongsim-countries-payload-v2"], {
      revalidate: BONGSIM_COUNTRIES_REVALIDATE_SEC,
      tags: ["bongsim-countries-payload", "bongsim-recommend-bootstrap"],
    })();
    lastGoodCountries = res;
    return res;
  } catch (e) {
    if (lastGoodCountries) {
      console.warn(
        "[loadBongsimCountriesPayloadCached] serving last-good countries after catalog miss",
        e instanceof Error ? e.message : e,
      );
      return lastGoodCountries;
    }
    const msg = String(e instanceof Error ? e.message : e);
    if (msg.includes("connection_timeout")) return { ok: false, reason: "connection_timeout" };
    if (msg.includes("db_unconfigured")) return { ok: false, reason: "db_unconfigured" };
    return { ok: false, reason: "db_error" };
  }
}
