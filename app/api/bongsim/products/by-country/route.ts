import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { slimProductsByCountryForApi } from "@/lib/bongsim/data/slim-products-by-country-payload";
import {
  loadProductsByCountryCached,
  PRODUCTS_BY_COUNTRY_REVALIDATE_SEC,
} from "@/lib/bongsim/data/load-products-by-country-cached";

/** Next.js segment config — must be a literal (not imported). Keep in sync with PRODUCTS_BY_COUNTRY_REVALIDATE_SEC. */
export const revalidate = 120;
export const maxDuration = 30;

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

  const res = await loadProductsByCountryCached(selectedCodes);

  if (!res.ok) {
    if (res.reason === "db_unconfigured") {
      return jsonWithLeakGuard(
        { error: "DB not configured", reason: res.reason },
        "bongsim.products.by-country",
        { status: 500 },
      );
    }
    return jsonWithLeakGuard(
      { error: "query failed", reason: res.reason },
      "bongsim.products.by-country",
      { status: 500 },
    );
  }

  const payload = slimProductsByCountryForApi(res);

  const response = jsonWithLeakGuard(payload, "bongsim.products.by-country");
  response.headers.set(
    "Cache-Control",
    `public, s-maxage=${PRODUCTS_BY_COUNTRY_REVALIDATE_SEC}, stale-while-revalidate=${PRODUCTS_BY_COUNTRY_REVALIDATE_SEC * 2}`,
  );
  return response;
}
