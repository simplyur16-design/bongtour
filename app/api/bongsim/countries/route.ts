import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { loadBongsimCountriesPayloadCached } from "@/lib/bongsim/data/load-bongsim-countries-cached";
import type { BongsimCountryListItem } from "@/lib/bongsim/data/load-recommend-bootstrap";

export const revalidate = 120;
export type { BongsimCountryListItem };

/**
 * GET /api/bongsim/countries
 *
 * `bongsim_product_option`에 **단독(단일 국가) 플랜**이 있는 국가만 반환.
 * heroMap 없이 카탈로그만 — bootstrap 전체 로드보다 가볍게.
 */
function statusForCatalogFailure(reason: string): number {
  return reason === "db_unconfigured" || reason === "connection_timeout" ? 503 : 500;
}

export async function GET() {
  const res = await loadBongsimCountriesPayloadCached();
  if (!res.ok) {
    return jsonWithLeakGuard(
      {
        error: res.reason === "db_unconfigured" ? "DB not configured" : "query failed",
        reason: res.reason,
      },
      "bongsim.countries.list",
      { status: statusForCatalogFailure(res.reason) },
    );
  }

  return jsonWithLeakGuard(
    { countries: res.countries, catalogMeta: res.catalogMeta },
    "bongsim.countries.list",
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
}
