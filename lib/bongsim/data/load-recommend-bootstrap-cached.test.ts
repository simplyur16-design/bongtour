import { describe, expect, it } from "vitest";
import { BONGSIM_RECOMMEND_BOOTSTRAP_REVALIDATE_SEC } from "@/lib/bongsim/data/load-recommend-bootstrap-cached";
import { CATALOG_LIST_REVALIDATE_SEC } from "@/lib/bongsim/data/list-catalog-products-cached";

describe("bongsim recommend bootstrap P3 cache", () => {
  it("recommend bootstrap revalidate 120s", () => {
    expect(BONGSIM_RECOMMEND_BOOTSTRAP_REVALIDATE_SEC).toBe(120);
  });

  it("catalog list revalidate 120s", () => {
    expect(CATALOG_LIST_REVALIDATE_SEC).toBe(120);
  });
});
