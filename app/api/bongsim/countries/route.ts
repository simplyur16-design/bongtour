import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { loadBongsimCountriesPayloadCached } from "@/lib/bongsim/data/load-bongsim-countries-cached";
import type { BongsimCountryListItem } from "@/lib/bongsim/data/load-recommend-bootstrap";

export const dynamic = "force-dynamic";
export const maxDuration = 20;
export type { BongsimCountryListItem };

const COUNTRIES_HANDLER_BUDGET_MS = 12_000;

/**
 * GET /api/bongsim/countries
 *
 * `bongsim_product_option`에 **단독(단일 국가) 플랜**이 있는 국가만 반환.
 * heroMap 없이 카탈로그만 — bootstrap 전체 로드보다 가볍게.
 */
function statusForCatalogFailure(reason: string): number {
  return reason === "db_unconfigured" || reason === "connection_timeout" ? 503 : 500;
}

// REGRESSION-FREEZE[bongsim-countries-handler-budget]: countries hard timeout — manifest
export async function GET() {
  let res: Awaited<ReturnType<typeof loadBongsimCountriesPayloadCached>>;
  try {
    res = await Promise.race([
      loadBongsimCountriesPayloadCached(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("countries_handler_timeout")), COUNTRIES_HANDLER_BUDGET_MS),
      ),
    ]);
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    const reason = msg.includes("countries_handler_timeout") ? "connection_timeout" : "db_error";
    console.error("[bongsim.countries.list] handler budget", msg);
    return jsonWithLeakGuard(
      {
        error: "query failed",
        reason,
      },
      "bongsim.countries.list",
      { status: statusForCatalogFailure(reason), headers: { "Cache-Control": "no-store" } },
    );
  }

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
