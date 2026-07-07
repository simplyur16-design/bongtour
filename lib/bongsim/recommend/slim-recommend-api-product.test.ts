import { describe, expect, it } from "vitest";
import { slimProductForRecommendApi } from "@/lib/bongsim/recommend/slim-recommend-api-product";
import type { ProductOption } from "@/lib/bongsim/recommend/product-option";

function row(partial: Partial<ProductOption> & Pick<ProductOption, "option_api_id">): ProductOption {
  return {
    option_api_id: partial.option_api_id,
    plan_name: partial.plan_name ?? "일본",
    network_family: partial.network_family ?? "roaming",
    plan_type: partial.plan_type ?? "daily",
    days_raw: partial.days_raw ?? "3일",
    allowance_label: partial.allowance_label ?? "500MB",
    option_label: partial.option_label ?? "",
    flags: partial.flags ?? {},
    price_block: partial.price_block ?? {
      after: { recommended_krw: 9900, consumer_krw: 12000, supply_krw: 8000 },
      before: { recommended_krw: 11000, consumer_krw: 13000, supply_krw: 9000 },
    },
    recommended_price: partial.recommended_price,
  };
}

describe("slimProductForRecommendApi", () => {
  it("recommended_price 있으면 price_block before/after 제거", () => {
    const slim = slimProductForRecommendApi(row({ option_api_id: "a", recommended_price: 9900 }));
    expect(slim.recommended_price).toBe(9900);
    expect(slim.price_block).toEqual({});
    expect(JSON.stringify(slim)).not.toContain("consumer_krw");
  });

  it("recommended_price·price_block 모두 없으면 price_block 유지", () => {
    const slim = slimProductForRecommendApi(
      row({ option_api_id: "b", price_block: { after: {}, before: {} } }),
    );
    expect(slim.price_block).toEqual({ after: {}, before: {} });
  });
});
