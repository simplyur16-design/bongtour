import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { listBongsimStandaloneCountries } from "@/lib/bongsim/data/list-standalone-countries";
import { getPgPool } from "@/lib/bongsim/db/pool";

/** Next 15 GET Route Handler 기본 비캐시 대응 — 플랜 메타 반영 지연 허용 */
export const revalidate = 120;
export const dynamic = "force-dynamic";

export type BongsimCountryListItem = {
  code: string;
  nameKr: string;
};

/**
 * GET /api/bongsim/countries
 *
 * `bongsim_product_option`에 **단독(단일 국가) 플랜**이 있는 국가만 반환.
 * 다국가 플랜명(`MULTI_COUNTRY_PLAN_COVERAGE` 키)만으로 커버되는 행은 제외.
 */
export async function GET() {
  const pool = getPgPool();
  if (!pool) {
    return jsonWithLeakGuard({ error: "DB not configured" }, "bongsim.countries.list", { status: 500 });
  }

  try {
    const countries = await listBongsimStandaloneCountries(pool);

    return jsonWithLeakGuard(
      { countries },
      "bongsim.countries.list",
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "query failed";
    console.error("[api/bongsim/countries]", e);
    return jsonWithLeakGuard({ error: msg }, "bongsim.countries.list", { status: 500 });
  }
}
