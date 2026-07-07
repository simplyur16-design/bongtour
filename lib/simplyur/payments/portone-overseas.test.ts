import { describe, expect, it } from "vitest";
import {
  isSimplyurPortonePaymentId,
  krwOrderTotalToUsdMinor,
  listConfiguredPortoneMethods,
  parseSimplyurPortoneMethod,
} from "@/lib/simplyur/payments/portone-methods";
import { resolvePortoneChannelKey } from "@/lib/simplyur/payments/portone-env";

describe("simplyur portone overseas PG", () => {
  it("parses PayPal and KICC methods", () => {
    expect(parseSimplyurPortoneMethod("paypal")).toBe("paypal");
    expect(parseSimplyurPortoneMethod("kicc_wechat")).toBe("kicc_wechat");
    expect(parseSimplyurPortoneMethod("card")).toBeNull();
  });

  it("USD minor units from KRW order total", () => {
    expect(krwOrderTotalToUsdMinor(1350)).toBe(100);
    expect(krwOrderTotalToUsdMinor(2025)).toBe(150);
  });

  it("simplyur paymentId prefix", () => {
    expect(isSimplyurPortonePaymentId("su-SU-001-abc")).toBe(true);
    expect(isSimplyurPortonePaymentId("other-id")).toBe(false);
  });

  it("lists methods when channel env present", () => {
    const prevPaypal = process.env.PORTONE_CHANNEL_KEY_PAYPAL;
    const prevKicc = process.env.PORTONE_CHANNEL_KEY_KICC;
    process.env.PORTONE_CHANNEL_KEY_PAYPAL = "ch-paypal";
    process.env.PORTONE_CHANNEL_KEY_KICC = "ch-kicc";
    try {
      expect(listConfiguredPortoneMethods(resolvePortoneChannelKey)).toEqual([
        "paypal",
        "kicc_wechat",
        "kicc_alipay_plus",
      ]);
    } finally {
      if (prevPaypal === undefined) delete process.env.PORTONE_CHANNEL_KEY_PAYPAL;
      else process.env.PORTONE_CHANNEL_KEY_PAYPAL = prevPaypal;
      if (prevKicc === undefined) delete process.env.PORTONE_CHANNEL_KEY_KICC;
      else process.env.PORTONE_CHANNEL_KEY_KICC = prevKicc;
    }
  });
});
