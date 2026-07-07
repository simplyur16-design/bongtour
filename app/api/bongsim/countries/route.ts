import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import {
  loadBongsimCountriesPayload,
  type BongsimCountryListItem,
} from "@/lib/bongsim/data/load-recommend-bootstrap";

export const revalidate = 120;
export type { BongsimCountryListItem };

/**
 * GET /api/bongsim/countries
 *
 * `bongsim_product_option`에 **단독(단일 국가) 플랜**이 있는 국가만 반환.
 */
export async function GET() {
  const res = await loadBongsimCountriesPayload();
  if (!res.ok) {
    return jsonWithLeakGuard(
      { error: res.reason === "db_unconfigured" ? "DB not configured" : "query failed" },
      "bongsim.countries.list",
      { status: 500 },
    );
  }

  return jsonWithLeakGuard(
    { countries: res.countries, catalogMeta: res.catalogMeta },
    "bongsim.countries.list",
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
}
