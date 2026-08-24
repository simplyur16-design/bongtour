import { describe, expect, it } from "vitest";
import { filterProductsByCountry } from "@/lib/bongsim/data/load-products-by-country";
import type { ProductOption } from "@/lib/bongsim/recommend/product-option";

function row(partial: Partial<ProductOption> & Pick<ProductOption, "plan_name">): ProductOption {
  return {
    option_api_id: partial.option_api_id ?? "id",
    plan_name: partial.plan_name,
    network_family: partial.network_family ?? "roaming",
    plan_type: partial.plan_type ?? "data",
    days_raw: partial.days_raw ?? "3일",
    allowance_label: partial.allowance_label ?? "",
    option_label: partial.option_label ?? "",
    price_block: partial.price_block ?? {},
    flags: partial.flags ?? {},
  };
}

describe("filterProductsByCountry", () => {
  it("단일 국가 plan_name 한글 매칭", () => {
    const all = [
      row({ option_api_id: "jp1", plan_name: "일본", network_family: "roaming" }),
      row({ option_api_id: "kr1", plan_name: "대한민국", network_family: "local" }),
    ];
    const res = filterProductsByCountry(all, ["jp"]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.individual.jp?.roaming.products).toHaveLength(1);
    expect(res.individual.jp?.roaming.products[0]?.option_api_id).toBe("jp1");
    expect(res.multi).toEqual([]);
  });

  it("2개국 이상이면 multi 후보 포함", () => {
    const all = [
      row({ option_api_id: "sea", plan_name: "동남아 3개국" }),
      row({ option_api_id: "jp1", plan_name: "일본" }),
    ];
    const res = filterProductsByCountry(all, ["my", "sg"]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.multi.some((p) => p.option_api_id === "sea")).toBe(true);
  });

  it("권역 pack matches all excel plan_name aliases", () => {
    const all = [
      row({ option_api_id: "c1", plan_name: "코카서스 3국(경유팩)" }),
      row({ option_api_id: "c2", plan_name: "코카서스 3개국(경유팩)" }),
      row({ option_api_id: "jp1", plan_name: "일본" }),
    ];
    const res = filterProductsByCountry(all, ["rg-caucasus-3"]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.individual["rg-caucasus-3"]?.roaming.products.map((p) => p.option_api_id).sort()).toEqual([
      "c1",
      "c2",
    ]);
  });
});
