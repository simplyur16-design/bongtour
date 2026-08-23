import { describe, expect, it } from "vitest";
import {
  AFTER_CONSUMER_BASIS_KEY,
  afterConsumerSellKrw,
  afterRecommendedSellKrw,
} from "@/lib/bongsim/data/pricing-after-recommended-krw";
import { selectChargedUnitPriceKrw } from "@/lib/bongsim/data/pricing-select-charged";
import { BONGSIM_PRICE_EFFECTIVE_FROM_20260901 } from "@/lib/bongsim/data/pricing-effective-from";

// REGRESSION-FREEZE[bongsim-charge-consumer-affiliation-25pct]: 소비자가 기준 + 명함 25% — manifest
// REGRESSION-FREEZE[bongsim-price-effective-from]: effective_from cutover — manifest

const BEFORE_MS = Date.parse(BONGSIM_PRICE_EFFECTIVE_FROM_20260901) - 60_000;
const AFTER_MS = Date.parse(BONGSIM_PRICE_EFFECTIVE_FROM_20260901) + 60_000;

describe("afterConsumerSellKrw", () => {
  it("uses supply × 5/3 list when no effective_from", () => {
    expect(
      afterConsumerSellKrw({
        before: { recommended_krw: 1000, consumer_krw: 2000, supply_krw: 3600 },
        after: { recommended_krw: 11700, consumer_krw: 13000, supply_krw: 3600 },
      }),
    ).toBe(6000);
  });

  it("uses before.supply list before effective_from", () => {
    expect(
      afterConsumerSellKrw(
        {
          before: { recommended_krw: 9000, consumer_krw: 10000, supply_krw: 3600 },
          after: { recommended_krw: 11700, consumer_krw: 13000, supply_krw: 4800 },
          effective_from: BONGSIM_PRICE_EFFECTIVE_FROM_20260901,
        },
        BEFORE_MS,
      ),
    ).toBe(6000);
  });

  it("uses after.supply list after effective_from", () => {
    expect(
      afterConsumerSellKrw(
        {
          before: { recommended_krw: 9000, consumer_krw: 10000, supply_krw: 3600 },
          after: { recommended_krw: 11700, consumer_krw: 13000, supply_krw: 4800 },
          effective_from: BONGSIM_PRICE_EFFECTIVE_FROM_20260901,
        },
        AFTER_MS,
      ),
    ).toBe(8000);
  });

  it("falls back to recommended then consumer when supply is missing", () => {
    expect(afterConsumerSellKrw({ after: { recommended_krw: 11700 } })).toBe(11700);
    expect(afterConsumerSellKrw({ after: { consumer_krw: 13000 } })).toBe(13000);
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
  it("charges supply × 5/3 list (storefront base)", () => {
    const r = selectChargedUnitPriceKrw({
      before: { recommended_krw: 14000, consumer_krw: 15000, supply_krw: 9000 },
      after: { recommended_krw: 11700, consumer_krw: 13000, supply_krw: 3600 },
    });
    expect(r.unit_krw).toBe(6000);
    expect(r.basis_key).toBe(AFTER_CONSUMER_BASIS_KEY);
  });

  it("charges recommended when supply is missing", () => {
    const r = selectChargedUnitPriceKrw({
      before: { recommended_krw: null, consumer_krw: null, supply_krw: null },
      after: { recommended_krw: 11700, consumer_krw: null, supply_krw: null },
    });
    expect(r.unit_krw).toBe(11700);
    expect(r.basis_key).toBe(AFTER_CONSUMER_BASIS_KEY);
  });
});
