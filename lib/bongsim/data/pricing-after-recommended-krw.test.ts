import { describe, expect, it } from "vitest";
import { afterRecommendedSellKrw } from "@/lib/bongsim/data/pricing-after-recommended-krw";

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
