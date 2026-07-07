import { describe, expect, it } from "vitest";
import {
  ESIM_FIRST_PURCHASE_DISCOUNT_RATE_PCT,
  computeEsimFirstPurchaseDiscountKrw,
} from "@/lib/bongsim/promo/esim-first-purchase-discount";

describe("eSIM 첫구매 자동 할인 15%", () => {
  it("할인율 15%", () => {
    expect(ESIM_FIRST_PURCHASE_DISCOUNT_RATE_PCT).toBe(15);
  });

  it("subtotal=20000 → discount=3000", () => {
    expect(computeEsimFirstPurchaseDiscountKrw(20_000)).toBe(3_000);
  });

  it("subtotal=0 → discount=0", () => {
    expect(computeEsimFirstPurchaseDiscountKrw(0)).toBe(0);
  });

  it("subtotal=19999 → floor discount", () => {
    expect(computeEsimFirstPurchaseDiscountKrw(19_999)).toBe(2_999);
  });
});
