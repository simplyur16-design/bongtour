import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { isCatalogBucketKey } from "@/lib/bongsim/catalog/catalog-buckets";
import {
  CATALOG_LIST_REVALIDATE_SEC,
  listCatalogProductsPaginatedCached,
} from "@/lib/bongsim/data/load-catalog-page-bootstrap-cached";
import { getPgPool } from "@/lib/bongsim/db/pool";

/** Next.js segment config — must be a literal (not imported). Keep in sync with CATALOG_LIST_REVALIDATE_SEC. */
export const revalidate = 120;

export async function GET(req: Request) {
  if (!getPgPool()) {
    return jsonWithLeakGuard({ error: "db_unconfigured" }, "bongsim.products.list", { status: 503 });
  }

  const u = new URL(req.url);
  const network_family = u.searchParams.get("network_family");
  const plan_type = u.searchParams.get("plan_type");
  const q = u.searchParams.get("q");
  const bucketRaw = u.searchParams.get("bucket");
  const bucket = isCatalogBucketKey(bucketRaw) ? bucketRaw : null;
  const limit = Number.parseInt(u.searchParams.get("limit") ?? "24", 10);
  const offset = Number.parseInt(u.searchParams.get("offset") ?? "0", 10);

  const res = await listCatalogProductsPaginatedCached({
    network_family,
    plan_type,
    q,
    bucket,
    limit,
    offset,
  });

  if (!res.ok) {
    if (res.reason === "db_unconfigured") {
      return jsonWithLeakGuard({ error: "db_unconfigured" }, "bongsim.products.list", { status: 503 });
    }
    return jsonWithLeakGuard({ error: "db_error" }, "bongsim.products.list", { status: 500 });
  }

  const pageSize = Math.min(100, Math.max(1, Number.isFinite(limit) ? limit : 24));
  const page = Math.floor(Math.max(0, Number.isFinite(offset) ? offset : 0) / pageSize) + 1;

  const body = {
    schema: "bongsim.product_catalog.list.v1",
    items: res.rows,
    total: res.total,
    page,
    page_size: pageSize,
    ...(bucket ? { bucket } : {}),
  };

  const response = jsonWithLeakGuard(body, "bongsim.products.list");
  response.headers.set(
    "Cache-Control",
    `public, s-maxage=${CATALOG_LIST_REVALIDATE_SEC}, stale-while-revalidate=${CATALOG_LIST_REVALIDATE_SEC * 2}`,
  );
  return response;
}
