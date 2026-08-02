import { unstable_cache } from "next/cache";
import {
  listCatalogBucketCounts,
  listCatalogKycByPlanName,
  listCatalogProductsPaginated,
  type CatalogBucketCounts,
  type CatalogKycByPlanName,
  type ListCatalogProductsPaginatedParams,
  type ListCatalogProductsPaginatedResult,
} from "@/lib/bongsim/data/list-catalog-products";

// REGRESSION-FREEZE[bongsim-catalog-client-pagination-p4]: catalog bootstrap + paginated cache — manifest
// REGRESSION-FREEZE[bongsim-catalog-list-perf]: catalog bootstrap 실패 결과 캐시 금지 — manifest

export const CATALOG_LIST_REVALIDATE_SEC = 120;

export type CatalogPageBootstrap = {
  bucketCounts: CatalogBucketCounts;
  kycByPlanName: CatalogKycByPlanName;
};

export type CatalogPageBootstrapResult =
  | { ok: true; data: CatalogPageBootstrap }
  | { ok: false; reason: "db_unconfigured" | "db_error" | "connection_timeout" };

async function fetchCatalogBootstrapOrThrow(): Promise<CatalogPageBootstrap> {
  const [countsRes, kycRes] = await Promise.all([listCatalogBucketCounts(), listCatalogKycByPlanName()]);
  if (!countsRes.ok) throw new Error(`bongsim_catalog_bootstrap_${countsRes.reason}`);
  if (!kycRes.ok) throw new Error(`bongsim_catalog_bootstrap_${kycRes.reason}`);
  return {
    bucketCounts: countsRes.counts,
    kycByPlanName: kycRes.kycByPlanName,
  };
}

export async function loadCatalogPageBootstrapCached(): Promise<CatalogPageBootstrapResult> {
  try {
    const data = await unstable_cache(fetchCatalogBootstrapOrThrow, ["bongsim-catalog-page-bootstrap-v2"], {
      revalidate: CATALOG_LIST_REVALIDATE_SEC,
      tags: ["bongsim-catalog-list"],
    })();
    return { ok: true, data };
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    if (msg.includes("connection_timeout")) return { ok: false, reason: "connection_timeout" };
    if (msg.includes("db_unconfigured")) return { ok: false, reason: "db_unconfigured" };
    return { ok: false, reason: "db_error" };
  }
}

export async function listCatalogProductsPaginatedCached(
  params: ListCatalogProductsPaginatedParams,
): Promise<ListCatalogProductsPaginatedResult> {
  const key = JSON.stringify({
    network_family: params.network_family ?? null,
    plan_type: params.plan_type ?? null,
    q: params.q ?? null,
    bucket: params.bucket ?? null,
    limit: params.limit ?? 24,
    offset: params.offset ?? 0,
  });
  try {
    return await unstable_cache(
      async () => {
        const res = await listCatalogProductsPaginated(params);
        if (!res.ok) throw new Error(`bongsim_catalog_page_${res.reason}`);
        return res;
      },
      ["bongsim-catalog-page-v2", key],
      {
        revalidate: CATALOG_LIST_REVALIDATE_SEC,
        tags: ["bongsim-catalog-list"],
      },
    )();
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    if (msg.includes("connection_timeout")) return { ok: false, reason: "connection_timeout" };
    if (msg.includes("db_unconfigured")) return { ok: false, reason: "db_unconfigured" };
    return { ok: false, reason: "db_error" };
  }
}
