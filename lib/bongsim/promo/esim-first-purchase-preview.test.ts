import { describe, expect, it } from "vitest";
import { ESIM_FIRST_PURCHASE_DISCOUNT_RATE_PCT } from "@/lib/bongsim/promo/esim-first-purchase-discount";
import { resolveEsimFirstPurchasePreview } from "@/lib/bongsim/promo/esim-first-purchase-preview";

describe("resolveEsimFirstPurchasePreview", () => {
  it("구매자 식별 없음 → missing_buyer", async () => {
    const r = await resolveEsimFirstPurchasePreview({ subtotal_krw: 20_000, buyer_email: "" });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.reason).toBe("missing_buyer");
  });

  it("subtotal 0 → invalid_subtotal", async () => {
    const r = await resolveEsimFirstPurchasePreview({
      subtotal_krw: 0,
      buyer_email: "test@example.com",
    });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.reason).toBe("invalid_subtotal");
  });

  it("할인율 SSOT 15%", () => {
    expect(ESIM_FIRST_PURCHASE_DISCOUNT_RATE_PCT).toBe(15);
  });
});
