import { describe, expect, it } from "vitest";
import {
  bucketForCatalogRow,
  catalogBucketWhereSql,
  CATALOG_BUCKET_ORDER,
  CATALOG_PAGE_SIZE,
  isCatalogBucketKey,
} from "@/lib/bongsim/catalog/catalog-buckets";
import type { CatalogProductListRow } from "@/lib/bongsim/data/list-catalog-products";

function row(partial: Partial<CatalogProductListRow> & Pick<CatalogProductListRow, "network_family">): CatalogProductListRow {
  return {
    option_api_id: "opt-1",
    plan_name: "테스트",
    option_label: "옵션",
    plan_type: null,
    allowance_label: "1GB",
    days_raw: "7일",
    qos_raw: null,
    price_block: {},
    flags: {},
    ...partial,
  };
}

describe("catalog buckets", () => {
  it("bucketForCatalogRow — local / unlimited / daily / fixed", () => {
    expect(bucketForCatalogRow(row({ network_family: "local" }))).toBe("local");
    expect(bucketForCatalogRow(row({ network_family: "roaming", plan_type: "unlimited" }))).toBe(
      "roam_unlimited",
    );
    expect(bucketForCatalogRow(row({ network_family: "roaming", plan_type: "daily" }))).toBe("roam_daily");
    expect(bucketForCatalogRow(row({ network_family: "roaming", plan_type: "fixed" }))).toBe("roam_fixed");
    expect(bucketForCatalogRow(row({ network_family: "roaming", plan_type: null }))).toBe("roam_fixed");
  });

  it("isCatalogBucketKey", () => {
    expect(isCatalogBucketKey("local")).toBe(true);
    expect(isCatalogBucketKey("roam_daily")).toBe(true);
    expect(isCatalogBucketKey("invalid")).toBe(false);
    expect(isCatalogBucketKey(null)).toBe(false);
  });

  it("catalogBucketWhereSql covers all bucket keys", () => {
    for (const key of CATALOG_BUCKET_ORDER) {
      expect(catalogBucketWhereSql(key).length).toBeGreaterThan(5);
    }
  });

  it("CATALOG_PAGE_SIZE default 24", () => {
    expect(CATALOG_PAGE_SIZE).toBe(24);
  });
});
