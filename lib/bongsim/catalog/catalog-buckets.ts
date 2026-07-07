import type { CatalogProductListRow } from "@/lib/bongsim/data/list-catalog-products";

/** REGRESSION-FREEZE[bongsim-catalog-client-pagination-p4]: catalog bucket SSOT — manifest */

export type CatalogBucketKey = "local" | "roam_unlimited" | "roam_fixed" | "roam_daily";

export const CATALOG_BUCKET_ORDER: CatalogBucketKey[] = [
  "local",
  "roam_unlimited",
  "roam_fixed",
  "roam_daily",
];

export const CATALOG_BUCKET_META: Record<CatalogBucketKey, { title: string; description: string }> = {
  local: { title: "로컬", description: "국내 망 기준 요금제" },
  roam_unlimited: { title: "로밍 · 무제한", description: "해외 로밍 무제한 라인" },
  roam_fixed: { title: "로밍 · 종량제", description: "데이터 용량 기준 로밍" },
  roam_daily: { title: "로밍 · 데일리", description: "일 단위 로밍" },
};

export const CATALOG_PAGE_SIZE = 24;

export function bucketForCatalogRow(row: CatalogProductListRow): CatalogBucketKey {
  if (row.network_family === "local") return "local";
  const pt = row.plan_type;
  if (pt === "unlimited") return "roam_unlimited";
  if (pt === "daily") return "roam_daily";
  return "roam_fixed";
}

/** SQL fragment (no user input) — paired with BONGSIM_CATALOG_ACTIVE_WHERE */
export function catalogBucketWhereSql(bucket: CatalogBucketKey): string {
  switch (bucket) {
    case "local":
      return "network_family = 'local'";
    case "roam_unlimited":
      return "network_family <> 'local' AND plan_type = 'unlimited'";
    case "roam_daily":
      return "network_family <> 'local' AND plan_type = 'daily'";
    case "roam_fixed":
      return `network_family <> 'local' AND COALESCE(plan_type, '') NOT IN ('unlimited', 'daily')`;
  }
}

export function isCatalogBucketKey(raw: string | null | undefined): raw is CatalogBucketKey {
  return raw != null && (CATALOG_BUCKET_ORDER as string[]).includes(raw);
}
