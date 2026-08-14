import { describe, expect, it } from "vitest";
import { buildEsimQrDeliveredLmsText } from "@/lib/bongsim/notifications/esim-qr-lms";

// REGRESSION-FREEZE[bongsim-esim-lms-quick-install]: LMS body includes OS install URLs — manifest
describe("buildEsimQrDeliveredLmsText", () => {
  const lpa = "LPA:1$consumer.rsp.world$ABCDEF123456";

  it("includes iPhone and Galaxy quick-install URLs when LPA is present", () => {
    const text = buildEsimQrDeliveredLmsText({
      orderNumber: "BS-20260806-TEST",
      orderPageUrl: "https://bongtour.com/travel/esim/order/11111111-1111-1111-1111-111111111111/complete",
      downloadLink: lpa,
    });
    expect(text).toContain("iPhone 바로 설치");
    expect(text).toContain("esimsetup.apple.com");
    expect(text).toContain("Galaxy·Android 바로 설치");
    expect(text).toContain("esimsetup.android.com");
    expect(text).toContain("QR·설치코드 페이지");
    expect(text).toContain("/travel/esim/order/");
    expect(text).toMatch(/요금|데이터로밍/);
    expect(text).toMatch(/1회성/);
  });

  it("still includes order page when LPA is missing", () => {
    const text = buildEsimQrDeliveredLmsText({
      orderNumber: "BS-1",
      orderPageUrl: "https://bongtour.com/travel/esim/order/x/complete",
      downloadLink: null,
    });
    expect(text).not.toContain("esimsetup.apple.com");
    expect(text).not.toContain("esimsetup.android.com");
    expect(text).toContain("QR·설치코드 페이지");
  });
});
