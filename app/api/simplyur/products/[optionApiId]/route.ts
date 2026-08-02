import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { isSimplyurLocale, type SimplyurLocale } from "@/lib/simplyur/constants";
import { loadSimplyurKoreaProductByOptionId } from "@/lib/simplyur/catalog/load-korea-catalog";
import { CATALOG_REVALIDATE_SEC } from "@/lib/simplyur/catalog/load-korea-catalog-cached";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ optionApiId: string }> };

/**
 * GET /api/simplyur/products/[optionApiId]?locale=en
 */
export async function GET(req: Request, context: RouteContext) {
  const { optionApiId } = await context.params;
  const { searchParams } = new URL(req.url);
  const localeParam = searchParams.get("locale") ?? "en";
  const locale: SimplyurLocale = isSimplyurLocale(localeParam) ? localeParam : "en";

  const loaded = await loadSimplyurKoreaProductByOptionId(optionApiId, locale);
  if (!loaded.ok) {
    if (loaded.reason === "not_found" || loaded.reason === "not_korea") {
      return jsonWithLeakGuard({ error: loaded.reason }, "simplyur.products.detail", { status: 404 });
    }
    const status =
      loaded.reason === "db_unconfigured" || loaded.reason === "connection_timeout" ? 503 : 500;
    const err = jsonWithLeakGuard({ error: loaded.reason }, "simplyur.products.detail", { status });
    err.headers.set("Cache-Control", "no-store");
    return err;
  }

  const response = jsonWithLeakGuard({ locale, product: loaded.product }, "simplyur.products.detail");
  response.headers.set(
    "Cache-Control",
    `public, s-maxage=${CATALOG_REVALIDATE_SEC}, stale-while-revalidate=300`,
  );
  return response;
}
