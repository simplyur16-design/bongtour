import { describe, expect, it } from "vitest";
import { shouldHideMobileStickyBar } from "@/lib/mobile-sticky-bar-visibility";

describe("shouldHideMobileStickyBar", () => {
  it("keeps the site bar on eSIM landing and help", () => {
    expect(shouldHideMobileStickyBar("/travel/esim")).toBe(false);
    expect(shouldHideMobileStickyBar("/travel/esim/")).toBe(false);
    expect(shouldHideMobileStickyBar("/travel/esim/guide")).toBe(false);
    expect(shouldHideMobileStickyBar("/travel/esim/catalog")).toBe(false);
  });

  it("hides the site bar on purchase funnel so 결제하기 is tappable", () => {
    expect(shouldHideMobileStickyBar("/travel/esim/recommend")).toBe(true);
    expect(shouldHideMobileStickyBar("/travel/esim/product/abc")).toBe(true);
    expect(shouldHideMobileStickyBar("/travel/esim/checkout")).toBe(true);
    expect(shouldHideMobileStickyBar("/travel/esim/checkout/payment")).toBe(true);
    expect(shouldHideMobileStickyBar("/travel/esim/checkout/payment/welcomepay")).toBe(true);
    expect(shouldHideMobileStickyBar("/travel/esim/order/x/complete")).toBe(true);
    expect(shouldHideMobileStickyBar("/travel/esim/result")).toBe(true);
    expect(shouldHideMobileStickyBar("/travel/esim/checkout?optionApiId=KR-1")).toBe(true);
  });

  it("still hides simplyur surface", () => {
    expect(shouldHideMobileStickyBar("/simplyur")).toBe(true);
    expect(shouldHideMobileStickyBar("/simplyur/en/recommend")).toBe(true);
  });

  it("hides the site bar on mypage so the own tab dock is tappable", () => {
    expect(shouldHideMobileStickyBar("/mypage")).toBe(true);
    expect(shouldHideMobileStickyBar("/mypage/")).toBe(true);
    expect(shouldHideMobileStickyBar("/mypage/affiliation")).toBe(true);
    expect(shouldHideMobileStickyBar("/mypage/esim?tab=qr")).toBe(true);
  });

  it("hides the site bar on training program detail, not the catalog", () => {
    expect(shouldHideMobileStickyBar("/business")).toBe(false);
    expect(shouldHideMobileStickyBar("/business/programs")).toBe(false);
    expect(shouldHideMobileStickyBar("/business/programs/")).toBe(false);
    expect(shouldHideMobileStickyBar("/business/programs/otr-bt-0004")).toBe(true);
  });
});
