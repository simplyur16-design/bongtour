import { describe, expect, it } from "vitest";
import {
  ESIM_FIRST_PURCHASE_DISCOUNT_RATE_PCT,
  computeEsimFirstPurchaseDiscountKrw,
} from "@/lib/bongsim/data/checkout-create-order";

describe("checkout 첫구매 할인 연동", () => {
  it("checkout-create-order re-export — 15% 계산", () => {
    expect(ESIM_FIRST_PURCHASE_DISCOUNT_RATE_PCT).toBe(15);
    expect(computeEsimFirstPurchaseDiscountKrw(20_000)).toBe(3_000);
  });

  it("첫구매 consents 감사 필드 형태", () => {
    const discount = computeEsimFirstPurchaseDiscountKrw(20_000);
    const consentsJson: Record<string, unknown> = {
      first_purchase_discount: true,
      first_purchase_discount_krw: discount,
      first_purchase_discount_rate: ESIM_FIRST_PURCHASE_DISCOUNT_RATE_PCT,
    };
    expect(consentsJson).toEqual({
      first_purchase_discount: true,
      first_purchase_discount_krw: 3_000,
      first_purchase_discount_rate: 15,
    });
  });
});
