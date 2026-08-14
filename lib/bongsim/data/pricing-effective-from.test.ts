import { describe, expect, it } from "vitest";
import {
  BONGSIM_PRICE_EFFECTIVE_FROM_20260901,
  isBeforePriceEffectiveWindow,
  resolveActivePriceSide,
} from "@/lib/bongsim/data/pricing-effective-from";

// REGRESSION-FREEZE[bongsim-price-effective-from]: Sept 1 00:00 KST — manifest

describe("pricing-effective-from", () => {
  const block = {
    before: { consumer_krw: 9000, recommended_krw: null, supply_krw: 5000 },
    after: { consumer_krw: 11000, recommended_krw: null, supply_krw: 6000 },
    effective_from: BONGSIM_PRICE_EFFECTIVE_FROM_20260901,
  };

  it("locks cutover at 2026-09-01 00:00 KST", () => {
    expect(BONGSIM_PRICE_EFFECTIVE_FROM_20260901).toBe("2026-09-01T00:00:00+09:00");
    expect(Date.parse(BONGSIM_PRICE_EFFECTIVE_FROM_20260901)).toBe(Date.parse("2026-08-31T15:00:00.000Z"));
  });

  it("uses before before cutover and after after cutover", () => {
    const beforeMs = Date.parse(BONGSIM_PRICE_EFFECTIVE_FROM_20260901) - 1;
    const afterMs = Date.parse(BONGSIM_PRICE_EFFECTIVE_FROM_20260901);
    expect(isBeforePriceEffectiveWindow(block, beforeMs)).toBe(true);
    expect(resolveActivePriceSide(block, beforeMs).consumer_krw).toBe(9000);
    expect(isBeforePriceEffectiveWindow(block, afterMs)).toBe(false);
    expect(resolveActivePriceSide(block, afterMs).consumer_krw).toBe(11000);
  });
});
