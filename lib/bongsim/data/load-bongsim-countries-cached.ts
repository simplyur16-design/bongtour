import { unstable_cache } from "next/cache";
import {
  loadBongsimCountriesPayload,
  type BongsimCountryListItem,
} from "@/lib/bongsim/data/load-recommend-bootstrap";
import type { CountryCatalogMeta } from "@/lib/bongsim/data/list-country-catalog-meta";

export const BONGSIM_COUNTRIES_REVALIDATE_SEC = 120;

export type BongsimCountriesCachedResult =
  | { ok: true; countries: BongsimCountryListItem[]; catalogMeta: Record<string, CountryCatalogMeta> }
  | { ok: false; reason: "db_unconfigured" | "db_error" };

/** countries API 전용 — heroMap(Prisma) 없이 카탈로그만 (bootstrap 전체보다 가벼움) */
export function loadBongsimCountriesPayloadCached(): Promise<BongsimCountriesCachedResult> {
  return unstable_cache(
    () => loadBongsimCountriesPayload(),
    ["bongsim-countries-payload"],
    {
      revalidate: BONGSIM_COUNTRIES_REVALIDATE_SEC,
      tags: ["bongsim-countries-payload", "bongsim-recommend-bootstrap"],
    },
  )();
}
