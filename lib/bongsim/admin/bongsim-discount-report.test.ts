import { describe, expect, it } from "vitest";
import {
  BONGSIM_DISCOUNT_REPORT_COMPLIMENTARY_CODE,
  summarizeBongsimDiscountReportRows,
} from "@/lib/bongsim/admin/bongsim-discount-report";
import { supplyLineTotalKrw } from "@/lib/bongsim/admin/line-supply-cost";
import {
  afterRecommendedSellKrw,
  afterSupplyCostKrw,
} from "@/lib/bongsim/data/pricing-after-recommended-krw";

describe("afterSupplyCostKrw", () => {
  it("reads after.supply_krw only", () => {
    expect(
      afterSupplyCostKrw({
        after: { recommended_krw: 10000, supply_krw: 7000 },
      }),
    ).toBe(7000);
    expect(afterSupplyCostKrw({ after: { recommended_krw: 10000, supply_krw: null } })).toBeNull();
    expect(afterSupplyCostKrw({ before: { supply_krw: 5000 } })).toBeNull();
  });

  it("does not fall back to recommended for sell price helper", () => {
    expect(afterRecommendedSellKrw({ after: { supply_krw: 7000 } })).toBeNull();
  });
});

describe("supplyLineTotalKrw", () => {
  it("multiplies snapshot supply by quantity", () => {
    const total = supplyLineTotalKrw(
      { price_block: { after: { supply_krw: 3000, recommended_krw: 5000 } } },
      2,
    );
    expect(total).toBe(6000);
  });
});

describe("bongsim-discount-report", () => {
  it("complimentary code label is fixed", () => {
    expect(BONGSIM_DISCOUNT_REPORT_COMPLIMENTARY_CODE).toBe("무상eSIM");
  });

  it("summarize totals discount and final", () => {
    const summary = summarizeBongsimDiscountReportRows([
      {
        used_at: new Date(),
        order_number: "BS-1",
        code: "CPN",
        description: null,
        original_amount_krw: "10000",
        discount_amount_krw: "3000",
        final_amount_krw: "7000",
        buyer_email: "a@b.com",
        source: "coupon",
      },
      {
        used_at: new Date(),
        order_number: "BS-2",
        code: "무상eSIM",
        description: "CS 보상",
        original_amount_krw: "20000",
        discount_amount_krw: "20000",
        final_amount_krw: "0",
        buyer_email: "010@b.com",
        source: "complimentary_esim",
      },
    ]);
    expect(summary.count).toBe(2);
    expect(summary.total_discount_krw).toBe(23000);
    expect(summary.total_final_krw).toBe(7000);
  });
});
