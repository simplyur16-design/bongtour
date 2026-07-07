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

export const CATALOG_LIST_REVALIDATE_SEC = 120;

export type CatalogPageBootstrap = {
  bucketCounts: CatalogBucketCounts;
  kycByPlanName: CatalogKycByPlanName;
};

export function loadCatalogPageBootstrapCached(): Promise<
  { ok: true; data: CatalogPageBootstrap } | { ok: false; reason: "db_unconfigured" | "db_error" }
> {
  return unstable_cache(
    async () => {
      const [countsRes, kycRes] = await Promise.all([listCatalogBucketCounts(), listCatalogKycByPlanName()]);
      if (!countsRes.ok) return { ok: false as const, reason: countsRes.reason };
      if (!kycRes.ok) return { ok: false as const, reason: kycRes.reason };
      return {
        ok: true as const,
        data: {
          bucketCounts: countsRes.counts,
          kycByPlanName: kycRes.kycByPlanName,
        },
      };
    },
    ["bongsim-catalog-page-bootstrap"],
    { revalidate: CATALOG_LIST_REVALIDATE_SEC, tags: ["bongsim-catalog-list"] },
  )();
}

export function listCatalogProductsPaginatedCached(
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
  return unstable_cache(() => listCatalogProductsPaginated(params), ["bongsim-catalog-page", key], {
    revalidate: CATALOG_LIST_REVALIDATE_SEC,
    tags: ["bongsim-catalog-list"],
  })();
}
