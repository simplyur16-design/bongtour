import { describe, expect, it } from "vitest";
import { buildBookingIntakeFromNaverLocale } from "./adapter";
import { mapToNaverBookingKoPayload } from "./contract";

describe("naver-booking contract", () => {
  const base = {
    locale: "en" as const,
    productId: "prod-1",
    originSource: "hanatour",
    originCode: "HT-001",
    selectedDepartureDate: "2026-08-01",
    customerNameEn: "Jane Doe",
    customerBirthDate: "1990-01-15",
    customerPhone: "+821012345678",
    customerEmail: "jane@example.com",
    adultCount: 2,
    childWithBedCount: 1,
    childNoBedCount: 0,
    infantCount: 0,
    singleRoomRequested: false,
    preferredContactChannel: "email" as const,
    requestNotes: "Window seat if possible",
    privacyAgreed: true,
    marketingConsent: false,
  };

  it("maps locale intake to Korean Naver payload", () => {
    const ko = mapToNaverBookingKoPayload(base);
    expect(ko.customerNameEn).toBe("Jane Doe");
    expect(ko.customerNameKo).toBe("Jane Doe");
    expect(ko.childCount).toBe(1);
    expect(ko.memoKo).toContain("[simplyur locale: en]");
    expect(ko.memoKo).toContain("Window seat");
  });

  it("builds BookingIntakeDto for internal /api/bookings", () => {
    const dto = buildBookingIntakeFromNaverLocale(base);
    expect(dto.totalPax).toBe(3);
    expect(dto.customerNameKo).toBe("Jane Doe");
    expect(dto.requestNotes).toContain("simplyur locale");
  });
});
