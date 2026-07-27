import { describe, expect, it } from "vitest";
import { slimProductsByCountryForApi } from "@/lib/bongsim/data/slim-products-by-country-payload";
import type { ProductOption } from "@/lib/bongsim/recommend/product-option";

function opt(partial: Partial<ProductOption> & Pick<ProductOption, "option_api_id" | "days_raw">): ProductOption {
  return {
    plan_name: "일본",
    network_family: "roaming",
    plan_type: "daily",
    allowance_label: "1GB",
    option_label: "5일/ 매일 1GB",
    price_block: { after: { consumer_krw: 7100 } },
    flags: {},
    recommended_price: 7100,
    ...partial,
  };
}

describe("slimProductsByCountryForApi lite", () => {
  it("strips product arrays but keeps available_days and mins", () => {
    const res = slimProductsByCountryForApi({
      ok: true,
      individual: {
        jp: {
          roaming: {
            min_price: 1500,
            products: [
              opt({ option_api_id: "a", days_raw: "5일" }),
              opt({ option_api_id: "b", days_raw: "7일", recommended_price: 9400 }),
            ],
          },
          local: {
            min_price: 1700,
            products: [opt({ option_api_id: "c", days_raw: "5일", network_family: "local" })],
          },
          roaming_unlimited_min: 4000,
          local_unlimited_min: 4400,
        },
      },
      multi: [],
    });
    expect(res.individual.jp?.roaming.products).toEqual([]);
    expect(res.individual.jp?.local?.products).toEqual([]);
    expect(res.individual.jp?.available_days).toEqual([5, 7]);
    expect(res.individual.jp?.roaming.min_price).toBe(1500);
    expect(res.individual.jp?.local?.min_price).toBe(1700);
  });
});
