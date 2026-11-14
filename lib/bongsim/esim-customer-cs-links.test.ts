import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { USIMSA_CX_CONTACT_URL } from "@/lib/bongsim/constants";
import { buildTravelEsimOrderQrMailContent } from "@/lib/bongsim/email/travel-esim-order-qr-mail";
import { buildTravelEsimGratitudeMailContent } from "@/lib/bongsim/email/travel-esim-gratitude-coupon-mail";
import { buildTravelEsimRefundDoneMailContent } from "@/lib/bongsim/email/travel-esim-refund-done-mail";

const CONTACT = "https://www.usimsa.com/board/contact-channel/";
const FORBIDDEN = ["pf.kakao.com/_fqTkK", "pf.kakao.com/_xlxjrxlX", "USIMSA_CX_KAKAO_CHAT_URL"] as const;

const ESIM_CS_SOURCES = [
  "lib/bongsim/constants.ts",
  "lib/bongsim/notifications/esim-qr-lms.ts",
  "lib/bongsim/email/travel-esim-order-qr-mail.ts",
  "lib/bongsim/email/travel-esim-gratitude-coupon-mail.ts",
  "lib/bongsim/email/travel-esim-refund-done-mail.ts",
  "lib/simplyur/email/simplyur-esim-qr-mail.ts",
  "components/bongsim/EsimMypageUsimsaCsLinks.tsx",
  "components/bongsim/EsimSupportFootnote.tsx",
  "components/bongsim/esim/EsimVerificationGuideContent.tsx",
  "components/bongsim/EsimBongsimCsLinks.tsx",
  "app/travel/esim/EsimLandingWhySection.tsx",
  "app/travel/esim/policy/page.tsx",
] as const;

function assertNoForbiddenKakao(label: string, text: string) {
  expect(
    text.includes(CONTACT) || text.includes("USIMSA_CX_CONTACT_URL"),
    `${label} must reference the USIMSA contact-channel URL`,
  ).toBe(true);
  for (const needle of FORBIDDEN) {
    expect(text, `${label} must not contain ${needle}`).not.toContain(needle);
  }
}

describe("eSIM customer guidance CS links", () => {
  it("uses only the USIMSA contact-channel URL", () => {
    expect(USIMSA_CX_CONTACT_URL).toBe(CONTACT);
    for (const rel of ESIM_CS_SOURCES) {
      const text = readFileSync(resolve(process.cwd(), rel), "utf8");
      if (rel === "lib/bongsim/constants.ts") {
        expect(text).toContain(CONTACT);
        expect(text).not.toContain("pf.kakao.com/_fqTkK");
        expect(text).not.toContain("USIMSA_CX_KAKAO_CHAT_URL");
        continue;
      }
      assertNoForbiddenKakao(rel, text);
    }
  });

  it("omits Kakao links from the issuance email and keeps only the USIMSA CS URL", () => {
    const mail = buildTravelEsimOrderQrMailContent({
      to: "traveler@example.com",
      orderNumber: "BS-20261114-TEST",
      qrCodeUrl: "https://cdn.example/qr.png",
      downloadLink: "LPA:1$smdp.example$code",
      orderPageUrl: "https://bongtour.com/travel/esim/order/00000000-0000-0000-0000-000000000001/complete",
    });
    assertNoForbiddenKakao("qr mail html", mail.html);
    assertNoForbiddenKakao("qr mail text", mail.text);
    expect(mail.text).toContain("── 고객센터 ──");
    expect(mail.html).not.toContain("카카오톡");
    expect(mail.text).not.toContain("카카오톡");
  });

  it("omits Kakao links from the gratitude and refund emails", () => {
    const coupon = buildTravelEsimGratitudeMailContent({
      to: "traveler@example.com",
      recipientName: "테스트",
      tripName: "테스트 상품",
      couponCode: "TESTCODE",
      departureDateYmd: "2026-12-01",
    });
    assertNoForbiddenKakao("coupon html", coupon.html);
    assertNoForbiddenKakao("coupon text", coupon.text);
    expect(coupon.html).not.toContain("카카오톡");

    const refund = buildTravelEsimRefundDoneMailContent({
      to: "traveler@example.com",
      orderNumber: "BS-1",
      refundAmount: "6,660",
    });
    assertNoForbiddenKakao("refund html", refund.html);
    assertNoForbiddenKakao("refund text", refund.text);
    expect(refund.html).not.toContain("카카오톡");
  });
});
