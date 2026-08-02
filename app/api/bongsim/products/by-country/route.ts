import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { slimProductsByCountryForApi } from "@/lib/bongsim/data/slim-products-by-country-payload";
import {
  loadProductsByCountryCached,
  PRODUCTS_BY_COUNTRY_REVALIDATE_SEC,
} from "@/lib/bongsim/data/load-products-by-country-cached";
import { healBongsimPgPoolForCatalog, probePgPoolTlsOrFallback } from "@/lib/bongsim/db/pool";

/** 과거 실패 Route Cache가 국가별로 굳지 않게 — DB는 unstable_cache로만 메모 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// REGRESSION-FREEZE[bongsim-by-country-slim-prefetch]: by-country outer heal+retry — manifest

/**
 * GET /api/bongsim/products/by-country?codes=jp,kr
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const codesStr = searchParams.get("codes") || "";

  const selectedCodes = codesStr
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);

  if (selectedCodes.length === 0) {
    return jsonWithLeakGuard(
      { error: "codes parameter required" },
      "bongsim.products.by-country",
      { status: 400 },
    );
  }

  let res = await loadProductsByCountryCached(selectedCodes);

  // plans 와 동일 — cold miss·풀 잔상으로 jp만 되고 타국이 비는 경우 캐시 밖 1회 복구
  if (!res.ok && res.reason !== "db_unconfigured") {
    console.warn("[by-country] catalog miss; healing pool and retrying once", res.reason);
    await probePgPoolTlsOrFallback();
    await healBongsimPgPoolForCatalog(`by-country:${res.reason}`);
    res = await loadProductsByCountryCached(selectedCodes);
  }

  if (!res.ok) {
    const status =
      res.reason === "db_unconfigured" || res.reason === "connection_timeout" ? 503 : 500;
    const errRes = jsonWithLeakGuard(
      {
        error: res.reason === "db_unconfigured" ? "DB not configured" : "query failed",
        reason: res.reason,
      },
      "bongsim.products.by-country",
      { status },
    );
    errRes.headers.set("Cache-Control", "no-store");
    return errRes;
  }

  const payload = slimProductsByCountryForApi(res);

  const response = jsonWithLeakGuard(payload, "bongsim.products.by-country");
  response.headers.set(
    "Cache-Control",
    `public, s-maxage=${PRODUCTS_BY_COUNTRY_REVALIDATE_SEC}, stale-while-revalidate=${PRODUCTS_BY_COUNTRY_REVALIDATE_SEC * 2}`,
  );
  return response;
}
