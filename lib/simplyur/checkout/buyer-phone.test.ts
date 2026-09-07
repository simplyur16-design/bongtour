import { describe, expect, it } from "vitest";
import {
  isValidSimplyurBuyerPhoneInput,
  normalizeSimplyurBuyerPhone,
} from "@/lib/simplyur/checkout/buyer-phone";

// REGRESSION-FREEZE[simplyur-esim-solapi-sms]: phone required 8–15 digits — manifest
describe("simplyur buyer phone", () => {
  it("requires a number (empty is invalid)", () => {
    expect(isValidSimplyurBuyerPhoneInput("")).toBe(false);
    expect(isValidSimplyurBuyerPhoneInput("   ")).toBe(false);
    expect(normalizeSimplyurBuyerPhone("")).toBeNull();
  });

  it("accepts KR and international digit lengths", () => {
    expect(normalizeSimplyurBuyerPhone("010-1234-5678")).toBe("01012345678");
    expect(normalizeSimplyurBuyerPhone("+82 10 1234 5678")).toBe("821012345678");
    expect(normalizeSimplyurBuyerPhone("+1 2025551234")).toBe("12025551234");
  });

  it("rejects too short or too long", () => {
    expect(normalizeSimplyurBuyerPhone("1234567")).toBeNull();
    expect(normalizeSimplyurBuyerPhone("1234567890123456")).toBeNull();
  });
});
