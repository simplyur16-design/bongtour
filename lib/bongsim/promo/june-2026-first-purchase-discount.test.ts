import { describe, expect, it } from "vitest";
import {
  JUNE_2026_FIRST_PURCHASE_RATE_PCT,
  computeJune2026FirstPurchaseDiscountKrw,
  isJune2026PromoActive,
} from "@/lib/bongsim/promo/june-2026-first-purchase-discount";

describe("2026년 6월 1회 자동 할인", () => {
  it("할인율 10%", () => {
    expect(JUNE_2026_FIRST_PURCHASE_RATE_PCT).toBe(10);
  });

  it("subtotal=20000 → discount=2000", () => {
    expect(computeJune2026FirstPurchaseDiscountKrw(20_000)).toBe(2_000);
  });

  it("subtotal=0 → discount=0", () => {
    expect(computeJune2026FirstPurchaseDiscountKrw(0)).toBe(0);
  });

  it("2026-06-03 KST → 프로모션 활성", () => {
    expect(isJune2026PromoActive(new Date("2026-06-03T00:00:00+09:00"))).toBe(true);
  });

  it("2026-07-01 KST → 프로모션 비활성", () => {
    expect(isJune2026PromoActive(new Date("2026-07-01T00:00:00+09:00"))).toBe(false);
  });

  it("2025-06-15 KST → 프로모션 비활성", () => {
    expect(isJune2026PromoActive(new Date("2025-06-15T12:00:00+09:00"))).toBe(false);
  });
});
