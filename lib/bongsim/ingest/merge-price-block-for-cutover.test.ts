import { describe, expect, it } from "vitest";
import { BONGSIM_PRICE_EFFECTIVE_FROM_20260901 } from "@/lib/bongsim/data/pricing-effective-from";
import { mergePriceBlockForCutover } from "@/lib/bongsim/ingest/run-excel-import";

// REGRESSION-FREEZE[bongsim-price-effective-from]: new SKU scheduled hide — manifest

describe("mergePriceBlockForCutover", () => {
  const excelAfter = {
    after: { consumer_krw: 15000, recommended_krw: null, supply_krw: 8000 },
    before: { consumer_krw: null, recommended_krw: null, supply_krw: null },
  };

  it("stamps effective_from on brand-new SKUs (hide until cutover)", () => {
    const merged = mergePriceBlockForCutover(
      excelAfter as never,
      null,
      BONGSIM_PRICE_EFFECTIVE_FROM_20260901,
    );
    expect(merged.effective_from).toBe(BONGSIM_PRICE_EFFECTIVE_FROM_20260901);
    expect(merged.after.consumer_krw).toBe(15000);
    expect(merged.before.consumer_krw).toBeNull();
  });
});
