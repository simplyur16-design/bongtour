import { describe, expect, it } from "vitest";
import {
  AFTER_CONSUMER_BASIS_KEY,
  afterConsumerSellKrw,
  afterRecommendedSellKrw,
} from "@/lib/bongsim/data/pricing-after-recommended-krw";
import { selectChargedUnitPriceKrw } from "@/lib/bongsim/data/pricing-select-charged";

// REGRESSION-FREEZE[bongsim-charge-consumer-affiliation-25pct]: 소비자가 기준 + 명함 25% — manifest

describe("afterConsumerSellKrw", () => {
  it("uses after.consumer_krw only", () => {
    expect(
      afterConsumerSellKrw({
        before: { recommended_krw: 1000, consumer_krw: 2000 },
        after: { recommended_krw: 11700, consumer_krw: 13000 },
      }),
    ).toBe(13000);
  });

  it("does not fall back to recommended", () => {
    expect(afterConsumerSellKrw({ after: { recommended_krw: 11700 } })).toBeNull();
  });
});

describe("afterRecommendedSellKrw", () => {
  it("uses after.recommended_krw only", () => {
    expect(
      afterRecommendedSellKrw({
        before: { recommended_krw: 1000, consumer_krw: 2000 },
        after: { recommended_krw: 3000, consumer_krw: 4000 },
      }),
    ).toBe(3000);
  });

  it("does not fall back to before or consumer", () => {
    expect(afterRecommendedSellKrw({ before: { recommended_krw: 5000 }, after: { consumer_krw: 6000 } })).toBeNull();
    expect(afterRecommendedSellKrw({ before: { recommended_krw: 7000 }, after: {} })).toBeNull();
  });
});

describe("selectChargedUnitPriceKrw", () => {
  it("charges after.consumer_krw (storefront base)", () => {
    const r = selectChargedUnitPriceKrw({
      before: { recommended_krw: 14000, consumer_krw: 15000, supply_krw: 9000 },
      after: { recommended_krw: 11700, consumer_krw: 13000, supply_krw: 8000 },
    });
    expect(r.unit_krw).toBe(13000);
    expect(r.basis_key).toBe(AFTER_CONSUMER_BASIS_KEY);
  });

  it("does not fall back to recommended when consumer missing", () => {
    const r = selectChargedUnitPriceKrw({
      before: { recommended_krw: null, consumer_krw: null, supply_krw: null },
      after: { recommended_krw: 11700, consumer_krw: null, supply_krw: null },
    });
    expect(r.unit_krw).toBe(0);
    expect(r.basis_key).toBe("missing_all_price_cells");
  });
});
