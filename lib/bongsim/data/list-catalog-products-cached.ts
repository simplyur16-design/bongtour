import { unstable_cache } from "next/cache";
import {
  listCatalogProducts,
  type ListCatalogProductsParams,
  type ListCatalogProductsResult,
} from "@/lib/bongsim/data/list-catalog-products";

// REGRESSION-FREEZE[bongsim-recommend-server-bootstrap-p3]: catalog list cache — manifest

export const CATALOG_LIST_REVALIDATE_SEC = 120;

export function listCatalogProductsCached(
  params: ListCatalogProductsParams = {},
): Promise<ListCatalogProductsResult> {
  const key = JSON.stringify({
    network_family: params.network_family ?? null,
    plan_type: params.plan_type ?? null,
    q: params.q ?? null,
  });
  return unstable_cache(() => listCatalogProducts(params), ["bongsim-catalog-list", key], {
    revalidate: CATALOG_LIST_REVALIDATE_SEC,
    tags: ["bongsim-catalog-list"],
  })();
}
