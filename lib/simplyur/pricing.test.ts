import { describe, expect, it } from "vitest";
import { simplyurSellPriceKrw, SIMPLYUR_MARKUP_MULTIPLIER } from "@/lib/simplyur/pricing";

describe("simplyurSellPriceKrw", () => {
  it("applies 10% markup on after.consumer_krw", () => {
    expect(
      simplyurSellPriceKrw({
        after: { consumer_krw: 10000, recommended_krw: 12000 },
      }),
    ).toBe(Math.ceil(10000 * SIMPLYUR_MARKUP_MULTIPLIER));
  });

  it("does not fall back to recommended_krw", () => {
    expect(simplyurSellPriceKrw({ after: { recommended_krw: 12000 } })).toBeNull();
  });
});
