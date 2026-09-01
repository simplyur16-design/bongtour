import { describe, expect, it } from "vitest";
import {
  affiliationMemberDiscountKrw,
  affiliationMemberNetKrw,
  storefrontDisplayUnitKrw,
} from "@/lib/bongsim/press/affiliation-member-display-price";
import { PRESS_MEMBER_DISCOUNT_RATE_PCT } from "@/lib/bongsim/press/press-member-discount-rate";

// REGRESSION-FREEZE[bongsim-charge-consumer-affiliation-25pct]: 소비자가 기준 + 명함 25% — manifest

describe("affiliationMemberDisplayPrice", () => {
  it("rate SSOT 25%", () => {
    expect(PRESS_MEMBER_DISCOUNT_RATE_PCT).toBe(25);
  });

  it("13000 → discount 3250, net 9750", () => {
    expect(affiliationMemberDiscountKrw(13_000)).toBe(3_250);
    expect(affiliationMemberNetKrw(13_000)).toBe(9_750);
    expect(storefrontDisplayUnitKrw(13_000, true)).toBe(9_750);
    expect(storefrontDisplayUnitKrw(13_000, false)).toBe(13_000);
  });

  it("does not cut below supply × 1.25", () => {
    expect(affiliationMemberNetKrw(4700, 2350)).toBe(3525);
    expect(affiliationMemberNetKrw(4000, 3600)).toBe(4000);
    expect(storefrontDisplayUnitKrw(4000, true, 3600)).toBe(4000);
  });
});
