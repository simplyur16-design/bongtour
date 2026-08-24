import { describe, expect, it } from "vitest";
import { buildAppleQuickInstallUrl, buildAndroidQuickInstallUrl } from "@/lib/bongsim/esim-install-presentation";
import { buildSimplyurEsimQrMailContent } from "@/lib/simplyur/email/simplyur-esim-qr-mail";
import { buildSimplyurRefundDoneMailContent } from "@/lib/simplyur/email/simplyur-refund-done-mail";

const LPA = "LPA:1$smdp.example$code";

describe("simplyur eSIM delivery mail", () => {
  it("includes QR, My eSIM, and OS install links", () => {
    const apple = buildAppleQuickInstallUrl(LPA);
    const android = buildAndroidQuickInstallUrl(LPA);
    expect(apple).toBeTruthy();
    expect(android).toBeTruthy();
    const mail = buildSimplyurEsimQrMailContent({
      to: "traveler@example.com",
      orderNumber: "BS-1",
      qrCodeUrl: "https://cdn.example/qr.png",
      downloadLink: LPA,
      smDpPlusAddress: "smdp.example",
      activationCode: "CODE",
      myEsimUrl: "https://bongtour.com/simplyur/en/my-esim",
    });
    expect(mail.subject).toContain("simplyur");
    expect(mail.html).toContain("Install on iPhone");
    expect(mail.html).toContain("Install on Android");
    expect(mail.html).toContain(apple!);
    expect(mail.html).toContain(android!);
    expect(mail.html).toContain("/simplyur/en/my-esim");
    expect(mail.html).not.toContain("카카오");
    expect(mail.text).toContain("iPhone install");
  });
});

describe("simplyur refund done mail", () => {
  it("states card cancel then supplier cancel", () => {
    const mail = buildSimplyurRefundDoneMailContent({
      to: "traveler@example.com",
      orderNumber: "BS-1",
      myEsimUrl: "https://bongtour.com/simplyur/en/my-esim",
    });
    expect(mail.html).toContain("Card payment reversed");
    expect(mail.html).toContain("Supplier eSIM profile cancelled");
    expect(mail.text).toContain("card payment was reversed");
    expect(mail.html).not.toContain("카카오");
  });
});
