import { describe, expect, it } from "vitest";
import { CATALOG_REVALIDATE_SEC } from "@/lib/simplyur/catalog/load-korea-catalog-cached";

describe("simplyur catalog cache P0", () => {
  it("카탈로그 revalidate 120초", () => {
    expect(CATALOG_REVALIDATE_SEC).toBe(120);
  });
});
