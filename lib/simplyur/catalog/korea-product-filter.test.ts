import { describe, expect, it } from "vitest";
import {
  isKoreaSingleCountryProduct,
  koreaCatalogPlanNamesForSql,
} from "@/lib/simplyur/catalog/korea-product-filter";
import type { ProductOption } from "@/lib/bongsim/recommend/product-option";

// REGRESSION-FREEZE[bongsim-caucasus-transit-pack]: simplyur 한국 SKU만 — manifest

function row(plan_name: string): ProductOption {
  return {
    option_api_id: plan_name,
    plan_name,
    network_family: "roaming",
    plan_type: "data",
    days_raw: "5일",
    allowance_label: "",
    option_label: "",
    price_block: {},
    flags: {},
  };
}

describe("isKoreaSingleCountryProduct", () => {
  it("keeps Korea SKUs the simplyur app sells", () => {
    expect(isKoreaSingleCountryProduct(row("대한민국"))).toBe(true);
    expect(isKoreaSingleCountryProduct(row("대한민국(3Mbps)"))).toBe(true);
  });

  it("rejects multi-country and Sept 1 transit packs so the Korea list cannot go empty or mix destinations", () => {
    expect(isKoreaSingleCountryProduct(row("한국/일본"))).toBe(false);
    expect(isKoreaSingleCountryProduct(row("한국/중국/일본"))).toBe(false);
    expect(isKoreaSingleCountryProduct(row("조지아(경유팩)"))).toBe(false);
    expect(isKoreaSingleCountryProduct(row("코카서스 3국(경유팩)"))).toBe(false);
    expect(isKoreaSingleCountryProduct(row("코카서스 3개국(경유팩)"))).toBe(false);
    expect(isKoreaSingleCountryProduct(row("일본"))).toBe(false);
  });
});

describe("koreaCatalogPlanNamesForSql", () => {
  it("names include 3Mbps Korea SKU and exclude Korea multi packs", () => {
    const names = koreaCatalogPlanNamesForSql();
    expect(names).toContain("대한민국");
    expect(names).toContain("대한민국(3Mbps)");
    expect(names).not.toContain("한국/일본");
    expect(names).not.toContain("조지아(경유팩)");
  });
});
