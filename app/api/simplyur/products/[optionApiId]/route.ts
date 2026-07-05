import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { isSimplyurLocale, type SimplyurLocale } from "@/lib/simplyur/constants";
import { loadSimplyurKoreaProductByOptionId } from "@/lib/simplyur/catalog/load-korea-catalog";

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

  const res = await loadSimplyurKoreaProductByOptionId(optionApiId, locale);
  if (!res.ok) {
    if (res.reason === "not_found" || res.reason === "not_korea") {
      return jsonWithLeakGuard({ error: res.reason }, "simplyur.products.detail", { status: 404 });
    }
    const status = res.reason === "db_unconfigured" ? 503 : 500;
    return jsonWithLeakGuard({ error: res.reason }, "simplyur.products.detail", { status });
  }

  return jsonWithLeakGuard({ locale, product: res.product }, "simplyur.products.detail");
}
