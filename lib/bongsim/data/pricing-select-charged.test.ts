import { describe, expect, it } from "vitest";
import {
  AFTER_CONSUMER_BASIS_KEY,
  afterConsumerSellKrw,
  afterRecommendedSellKrw,
} from "@/lib/bongsim/data/pricing-after-recommended-krw";
import { selectChargedUnitPriceKrw } from "@/lib/bongsim/data/pricing-select-charged";
import { BONGSIM_PRICE_EFFECTIVE_FROM_20260901 } from "@/lib/bongsim/data/pricing-effective-from";

// REGRESSION-FREEZE[bongsim-charge-consumer-affiliation-25pct]: 소비자가 기준 + 명함 25% — manifest
// REGRESSION-FREEZE[bongsim-display-recommended-floor]: 표시=권장소비자가 — manifest
// REGRESSION-FREEZE[bongsim-price-effective-from]: effective_from cutover — manifest

const BEFORE_MS = Date.parse(BONGSIM_PRICE_EFFECTIVE_FROM_20260901) - 60_000;
const AFTER_MS = Date.parse(BONGSIM_PRICE_EFFECTIVE_FROM_20260901) + 60_000;

describe("afterConsumerSellKrw", () => {
  it("uses 권장소비자가 as homepage list when no effective_from", () => {
    expect(
      afterConsumerSellKrw({
        before: { recommended_krw: 1000, consumer_krw: 2000, supply_krw: 3600 },
        after: { recommended_krw: 11700, consumer_krw: 13000, supply_krw: 3600 },
      }),
    ).toBe(11700);
  });

  it("uses before.recommended before effective_from", () => {
    expect(
      afterConsumerSellKrw(
        {
          before: { recommended_krw: 9000, consumer_krw: 10000, supply_krw: 3600 },
          after: { recommended_krw: 11700, consumer_krw: 13000, supply_krw: 4800 },
          effective_from: BONGSIM_PRICE_EFFECTIVE_FROM_20260901,
        },
        BEFORE_MS,
      ),
    ).toBe(9000);
  });

  it("uses after.recommended after effective_from", () => {
    expect(
      afterConsumerSellKrw(
        {
          before: { recommended_krw: 9000, consumer_krw: 10000, supply_krw: 3600 },
          after: { recommended_krw: 11700, consumer_krw: 13000, supply_krw: 4800 },
          effective_from: BONGSIM_PRICE_EFFECTIVE_FROM_20260901,
        },
        AFTER_MS,
      ),
    ).toBe(11700);
  });

  it("falls back to consumer then supply when 권장 is missing", () => {
    expect(afterConsumerSellKrw({ after: { consumer_krw: 13000 } })).toBe(13000);
    expect(afterConsumerSellKrw({ after: { supply_krw: 3600 } })).toBe(6000);
  });

  it("homepage is 권장소비자가 even when 소비자가 is higher", () => {
    expect(
      afterConsumerSellKrw({
        after: { consumer_krw: 4700, recommended_krw: 4300, supply_krw: 2350 },
      }),
    ).toBe(4300);
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
  it("charges 권장소비자가 as storefront base", () => {
    const r = selectChargedUnitPriceKrw({
      before: { recommended_krw: 14000, consumer_krw: 15000, supply_krw: 9000 },
      after: { recommended_krw: 11700, consumer_krw: 13000, supply_krw: 3600 },
    });
    expect(r.unit_krw).toBe(11700);
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
