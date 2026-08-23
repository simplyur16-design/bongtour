import { describe, expect, it } from "vitest";
import { BONGSIM_PRICE_EFFECTIVE_FROM_20260901 } from "@/lib/bongsim/data/pricing-effective-from";
import { simplyurSellPriceKrw, SIMPLYUR_MARKUP_MULTIPLIER } from "@/lib/simplyur/pricing";

// REGRESSION-FREEZE[bongsim-price-effective-from]: simplyur sell respects cutover — manifest

describe("simplyurSellPriceKrw", () => {
  it("applies 5% markup on effective recommended_krw", () => {
    expect(
      simplyurSellPriceKrw({
        after: { consumer_krw: 10000, recommended_krw: 12000 },
      }),
    ).toBe(Math.ceil(12000 * SIMPLYUR_MARKUP_MULTIPLIER));
  });

  it("falls back to consumer_krw when recommended is missing", () => {
    expect(simplyurSellPriceKrw({ after: { consumer_krw: 10000 } })).toBe(
      Math.ceil(10000 * SIMPLYUR_MARKUP_MULTIPLIER),
    );
  });

  it("uses before.recommended before Sept 1 00:00 KST cutover", () => {
    const cutover = Date.parse(BONGSIM_PRICE_EFFECTIVE_FROM_20260901);
    const block = {
      effective_from: BONGSIM_PRICE_EFFECTIVE_FROM_20260901,
      before: { consumer_krw: 8000, recommended_krw: 9000, supply_krw: 5000 },
      after: { consumer_krw: 10000, recommended_krw: 12000, supply_krw: 6000 },
    };
    expect(simplyurSellPriceKrw(block, cutover - 1)).toBe(Math.ceil(9000 * SIMPLYUR_MARKUP_MULTIPLIER));
    expect(simplyurSellPriceKrw(block, cutover)).toBe(Math.ceil(12000 * SIMPLYUR_MARKUP_MULTIPLIER));
  });
});
