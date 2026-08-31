import { describe, expect, it } from "vitest";
import {
  buildSimplyurMyEsimAbsoluteUrl,
  simplyurLocaleFromConsents,
  simplyurNotifyRequiresKakaoPhone,
  SIMPLYUR_REFUND_REMOTE_ORDER,
} from "@/lib/simplyur/notify/simplyur-qr-notify-policy";

describe("simplyur notify + refund order SSOT", () => {
  it("skips Kakao for simplyur app/web (Eximbay) and requires it for Bongtour", () => {
    expect(simplyurNotifyRequiresKakaoPhone("simplyur_web")).toBe(false);
    expect(simplyurNotifyRequiresKakaoPhone("simplyur_app")).toBe(false);
    expect(simplyurNotifyRequiresKakaoPhone("bongsim_web")).toBe(true);
    expect(simplyurNotifyRequiresKakaoPhone(null)).toBe(true);
  });

  it("reads simplyur_locale from consents", () => {
    expect(simplyurLocaleFromConsents({ simplyur_locale: "ja" })).toBe("ja");
    expect(simplyurLocaleFromConsents({ simplyur_locale: "ko" })).toBe("en");
    expect(simplyurLocaleFromConsents(null)).toBe("en");
  });

  it("points My eSIM mail links at /simplyur/{locale}/my-esim", () => {
    expect(buildSimplyurMyEsimAbsoluteUrl("en")).toMatch(/\/simplyur\/en\/my-esim$/);
    expect(buildSimplyurMyEsimAbsoluteUrl("ja")).toMatch(/\/simplyur\/ja\/my-esim$/);
  });

  it("refunds card (Eximbay) before USIMSA cancel", () => {
    expect(SIMPLYUR_REFUND_REMOTE_ORDER).toEqual(["eximbay_card_cancel", "usimsa_supplier_cancel"]);
  });
});
