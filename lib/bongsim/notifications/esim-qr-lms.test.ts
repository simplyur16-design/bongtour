import { describe, expect, it } from "vitest";
import {
  buildEsimQrDeliveredLmsText,
  esimQrNotifyMustSendOsQuickInstallLms,
  shouldSendBongtourEsimOsQuickInstallLms,
} from "@/lib/bongsim/notifications/esim-qr-lms";

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

  it("requires OS-install LMS whenever LPA is present", () => {
    // REGRESSION-FREEZE[bongsim-esim-qr-os-install-lms-always]: LPA → must send LMS — manifest
    expect(esimQrNotifyMustSendOsQuickInstallLms("LPA:1$consumer.rsp.world$ABCDEF123456")).toBe(true);
    expect(esimQrNotifyMustSendOsQuickInstallLms("https://example.com/qr")).toBe(false);
    expect(esimQrNotifyMustSendOsQuickInstallLms(null)).toBe(false);
    expect(esimQrNotifyMustSendOsQuickInstallLms("")).toBe(false);
  });

  it("sends OS-install LMS only for Bongtour channels, never Simplyur/Eximbay", () => {
    const lpa = "LPA:1$consumer.rsp.world$ABCDEF123456";
    expect(shouldSendBongtourEsimOsQuickInstallLms("web", lpa)).toBe(true);
    expect(shouldSendBongtourEsimOsQuickInstallLms("admin_complimentary_esim", lpa)).toBe(true);
    expect(shouldSendBongtourEsimOsQuickInstallLms("simplyur_app", lpa)).toBe(false);
    expect(shouldSendBongtourEsimOsQuickInstallLms("simplyur_web", lpa)).toBe(false);
    expect(shouldSendBongtourEsimOsQuickInstallLms("web", null)).toBe(false);
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
