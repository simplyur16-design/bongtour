import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import {
  isSimplyurLocale,
  SIMPLYUR_COUNTRY_CODES,
  SIMPLYUR_MARKET_COUNTRY,
  type SimplyurLocale,
} from "@/lib/simplyur/constants";
import {
  CATALOG_REVALIDATE_SEC,
  loadSimplyurKoreaCatalogCached,
} from "@/lib/simplyur/catalog/load-korea-catalog-cached";
import { getSimplyurMessages, t } from "@/lib/simplyur/i18n";

/** Next.js segment config — must be a literal (not imported). Keep in sync with CATALOG_REVALIDATE_SEC. */
export const revalidate = 120;

/**
 * GET /api/simplyur/products/by-country?codes=kr&locale=en
 * Korea only; prices = after.consumer_krw × 1.05 + locale currency display (FX ~12h cache).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const localeParam = searchParams.get("locale") ?? "en";
  const locale: SimplyurLocale = isSimplyurLocale(localeParam) ? localeParam : "en";

  const requested = (searchParams.get("codes") || "")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter((c) => (SIMPLYUR_COUNTRY_CODES as readonly string[]).includes(c));

  const selectedCodes = requested.length > 0 ? requested : [...SIMPLYUR_COUNTRY_CODES];
  if (selectedCodes.some((c) => c !== SIMPLYUR_MARKET_COUNTRY)) {
    return jsonWithLeakGuard(
      { error: "only_kr_supported_in_phase_1" },
      "simplyur.products.by-country",
      { status: 400 },
    );
  }

  const catalog = await loadSimplyurKoreaCatalogCached(locale);
  if (!catalog.ok) {
    const status =
      catalog.reason === "db_unconfigured" || catalog.reason === "connection_timeout" ? 503 : 500;
    return jsonWithLeakGuard(
      { error: catalog.reason, reason: catalog.reason },
      "simplyur.products.by-country",
      { status },
    );
  }

  const messages = await getSimplyurMessages(locale);

  const res = jsonWithLeakGuard(
    {
      locale,
      country_name: t(messages, "countries.kr.name"),
      pack: catalog.pack,
    },
    "simplyur.products.by-country",
  );
  res.headers.set(
    "Cache-Control",
    `public, s-maxage=${CATALOG_REVALIDATE_SEC}, stale-while-revalidate=300`,
  );
  return res;
}
