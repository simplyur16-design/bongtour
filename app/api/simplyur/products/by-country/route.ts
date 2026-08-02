import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import {
  isSimplyurLocale,
  SIMPLYUR_MARKET_COUNTRY,
  type SimplyurLocale,
} from "@/lib/simplyur/constants";
import {
  CATALOG_REVALIDATE_SEC,
  loadSimplyurKoreaCatalogCached,
} from "@/lib/simplyur/catalog/load-korea-catalog-cached";
import { healBongsimPgPoolForCatalog, probePgPoolTlsOrFallback } from "@/lib/bongsim/db/pool";
import { getSimplyurMessages, t } from "@/lib/simplyur/i18n";

/** 실패 Route Cache가 locale별로 굳지 않게 — DB는 unstable_cache로만 메모 */
export const dynamic = "force-dynamic";

// REGRESSION-FREEZE[simplyur-catalog-pool-resilience]: by-country outer heal+retry — manifest

/**
 * GET /api/simplyur/products/by-country?codes=kr&locale=en
 * Korea only; prices = after.consumer_krw × 1.05 + locale currency display (FX ~12h cache).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const localeParam = searchParams.get("locale") ?? "en";
  const locale: SimplyurLocale = isSimplyurLocale(localeParam) ? localeParam : "en";

  const rawCodes = (searchParams.get("codes") || "")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);

  // 비-kr 요청을 조용히 kr로 폴백하지 않음 (이전: codes=jp → 필터 후 빈 배열 → kr 200)
  if (rawCodes.some((c) => c !== SIMPLYUR_MARKET_COUNTRY)) {
    return jsonWithLeakGuard(
      { error: "only_kr_supported_in_phase_1" },
      "simplyur.products.by-country",
      { status: 400 },
    );
  }

  let catalog = await loadSimplyurKoreaCatalogCached(locale);
  if (!catalog.ok && catalog.reason !== "db_unconfigured") {
    console.warn("[simplyur/by-country] catalog miss; healing pool and retrying once", catalog.reason);
    await probePgPoolTlsOrFallback();
    await healBongsimPgPoolForCatalog(`simplyur/by-country:${catalog.reason}`);
    catalog = await loadSimplyurKoreaCatalogCached(locale);
  }

  if (!catalog.ok) {
    const status =
      catalog.reason === "db_unconfigured" || catalog.reason === "connection_timeout" ? 503 : 500;
    const errRes = jsonWithLeakGuard(
      { error: catalog.reason, reason: catalog.reason },
      "simplyur.products.by-country",
      { status },
    );
    errRes.headers.set("Cache-Control", "no-store");
    return errRes;
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
