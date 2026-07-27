import { describe, expect, it } from "vitest";
import { selectChargedUnitPriceKrw } from "@/lib/bongsim/data/pricing-select-charged";
import { AFTER_RECOMMENDED_BASIS_KEY } from "@/lib/bongsim/data/pricing-after-recommended-krw";

// REGRESSION-FREEZE[bongsim-charge-after-recommended-krw]: 체크아웃 청구 = 표시 after.recommended_krw — manifest

describe("selectChargedUnitPriceKrw", () => {
  it("charges after.recommended_krw not consumer_krw (11700 display vs 13000 charge bug)", () => {
    const r = selectChargedUnitPriceKrw({
      before: { recommended_krw: 14000, consumer_krw: 15000, supply_krw: 9000 },
      after: { recommended_krw: 11700, consumer_krw: 13000, supply_krw: 8000 },
    });
    expect(r.unit_krw).toBe(11700);
    expect(r.basis_key).toBe(AFTER_RECOMMENDED_BASIS_KEY);
  });

  it("does not fall back to consumer when recommended missing", () => {
    const r = selectChargedUnitPriceKrw({
      before: { recommended_krw: null, consumer_krw: 13000, supply_krw: null },
      after: { recommended_krw: null, consumer_krw: 13000, supply_krw: null },
    });
    expect(r.unit_krw).toBe(0);
    expect(r.basis_key).toBe("missing_all_price_cells");
  });
});
