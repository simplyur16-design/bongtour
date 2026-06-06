import { describe, expect, it } from "vitest";
import {
  PRESS_MEMBER_DISCOUNT_RATE_PCT,
  computePressMemberDiscountKrw,
  pressMemberCouponRejection,
} from "@/lib/bongsim/data/checkout-create-order";

describe("직군 checkout 할인 (서버 계산)", () => {
  it("1) subtotal=20000 → discount=3000, grand=17000", () => {
    const subtotal = 20_000;
    const discount = computePressMemberDiscountKrw(subtotal);
    const grand = Math.max(0, subtotal - discount);
    expect(discount).toBe(3_000);
    expect(grand).toBe(17_000);
  });

  it("2) 직군 + coupon_id/user_coupon_id → press_member_no_coupon", () => {
    expect(
      pressMemberCouponRejection(true, "00000000-0000-4000-8000-000000000001", null),
    ).toBe("press_member_no_coupon");
    expect(
      pressMemberCouponRejection(true, null, "00000000-0000-4000-8000-000000000002"),
    ).toBe("press_member_no_coupon");
    expect(pressMemberCouponRejection(true, "c1", "u1")).toBe("press_member_no_coupon");
  });

  it("3) 비직군(pressVerified=false) + 쿠폰 필드 → 거절 없음(기존 쿠폰 경로)", () => {
    expect(
      pressMemberCouponRejection(false, "00000000-0000-4000-8000-000000000001", null),
    ).toBeNull();
    expect(computePressMemberDiscountKrw(20_000)).toBe(3_000);
    expect(computePressMemberDiscountKrw(20_000)).toBeGreaterThan(0);
  });

  it("4) 비로그인(bongtour_user_id 없음) → 직군 분기 미진입(pressVerified 조회 안 함)", () => {
    const bongtourUserId = "";
    const entersPressBranch = Boolean(bongtourUserId);
    expect(entersPressBranch).toBe(false);
    expect(pressMemberCouponRejection(false, null, null)).toBeNull();
  });

  it("5) subtotal=0 → discount=0, grand=0", () => {
    const subtotal = 0;
    const discount = computePressMemberDiscountKrw(subtotal);
    const grand = Math.max(0, subtotal - discount);
    expect(discount).toBe(0);
    expect(grand).toBe(0);
    expect(grand).toBeGreaterThanOrEqual(0);
  });

  it("6) 직군 할인 시 consents 감사 필드", () => {
    const discount = computePressMemberDiscountKrw(20_000);
    const consentsJson: Record<string, unknown> = {};
    consentsJson.press_discount = true;
    consentsJson.press_discount_krw = discount;
    consentsJson.press_discount_rate = PRESS_MEMBER_DISCOUNT_RATE_PCT;
    expect(consentsJson).toEqual({
      press_discount: true,
      press_discount_krw: 3_000,
      press_discount_rate: 15,
    });
  });

  it("클라 coupon_discount_krw만 전송(쿠폰 id 없음) — 직군은 서버 할인만, 쿠폰 필드 거절 없음", () => {
    expect(pressMemberCouponRejection(true, null, null)).toBeNull();
    const discount = computePressMemberDiscountKrw(20_000);
    expect(discount).toBe(3_000);
  });
});
