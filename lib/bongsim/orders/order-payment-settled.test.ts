import { describe, expect, it } from "vitest";
import { isBongsimOrderPaymentSettled } from "@/lib/bongsim/orders/order-payment-settled";

describe("isBongsimOrderPaymentSettled", () => {
  it("accepts post-payment lifecycle statuses", () => {
    for (const s of ["paid", "fulfillment_queued", "fulfillment_in_progress", "fulfilled", "delivered"]) {
      expect(isBongsimOrderPaymentSettled(s)).toBe(true);
    }
  });

  it("rejects unpaid or terminal refund states", () => {
    for (const s of ["awaiting_payment", "draft", "refunded", "cancelled", "fulfillment_failed"]) {
      expect(isBongsimOrderPaymentSettled(s)).toBe(false);
    }
  });
});
