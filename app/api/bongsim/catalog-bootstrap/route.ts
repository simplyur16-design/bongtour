import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import {
  CATALOG_LIST_REVALIDATE_SEC,
  loadCatalogPageBootstrapCached,
} from "@/lib/bongsim/data/load-catalog-page-bootstrap-cached";
import { getPgPool } from "@/lib/bongsim/db/pool";

/** Client recover when SSR catalog bootstrap times out / fails. */
export const revalidate = 120;

export async function GET() {
  if (!getPgPool()) {
    return jsonWithLeakGuard({ ok: false, error: "db_unconfigured" }, "bongsim.catalog-bootstrap", {
      status: 503,
    });
  }

  const res = await loadCatalogPageBootstrapCached();
  if (!res.ok) {
    const status = res.reason === "db_unconfigured" ? 503 : 503;
    return jsonWithLeakGuard({ ok: false, error: res.reason }, "bongsim.catalog-bootstrap", {
      status,
    });
  }

  const response = jsonWithLeakGuard(
    {
      ok: true,
      schema: "bongsim.catalog-bootstrap.v1",
      bucketCounts: res.data.bucketCounts,
      kycByPlanName: res.data.kycByPlanName,
    },
    "bongsim.catalog-bootstrap",
  );
  response.headers.set(
    "Cache-Control",
    `public, s-maxage=${CATALOG_LIST_REVALIDATE_SEC}, stale-while-revalidate=${CATALOG_LIST_REVALIDATE_SEC * 2}`,
  );
  return response;
}
