import { describe, expect, it } from "vitest";

import {
  buildEximbayBasicAuthHeader,
  EXIMBAY_API_ORIGIN_LIVE,
  EXIMBAY_API_ORIGIN_TEST,
  resolveEximbayApiOrigin,
  resolveEximbaySdkScriptUrl,
  isSimplyurEximbayLiveEnabled,
} from "@/lib/simplyur/payments/eximbay-env";
import { buildEximbayReadyRequestBody, formatEximbayUsdAmountFromMinor } from "@/lib/simplyur/payments/eximbay-ready";
import { parseEximbayStatusQuery } from "@/lib/simplyur/payments/eximbay-verify";

describe("simplyur Eximbay env / Basic Auth", () => {
  // REGRESSION-FREEZE[simplyur-eximbay-payment-prep]
  it("buildEximbayBasicAuthHeader encodes apiKey: as Basic (docs test key)", () => {
    // https://developer.eximbay.com/eximbay/payment_linkage/preparing-payment.html
    const header = buildEximbayBasicAuthHeader("test_1849705C642C217E0B2D");
    expect(header).toBe("Basic dGVzdF8xODQ5NzA1QzY0MkMyMTdFMEIyRDo=");
  });

  it("resolveEximbayApiOrigin maps test vs production", () => {
    expect(resolveEximbayApiOrigin("test")).toBe(EXIMBAY_API_ORIGIN_TEST);
    expect(resolveEximbayApiOrigin("production")).toBe(EXIMBAY_API_ORIGIN_LIVE);
  });

  it("resolveEximbaySdkScriptUrl points at javascriptSDK.js", () => {
    expect(resolveEximbaySdkScriptUrl("test")).toBe(
      "https://api-test.eximbay.com/v2/javascriptSDK.js",
    );
    expect(resolveEximbaySdkScriptUrl("production")).toBe(
      "https://api.eximbay.com/v2/javascriptSDK.js",
    );
  });
});

describe("simplyur Eximbay ready payload", () => {
  // REGRESSION-FREEZE[simplyur-eximbay-payment-prep]
  it("formatEximbayUsdAmountFromMinor formats major USD string", () => {
    expect(formatEximbayUsdAmountFromMinor(100)).toBe("1");
    expect(formatEximbayUsdAmountFromMinor(150)).toBe("1.50");
  });

  it("buildEximbayReadyRequestBody matches request_pay shape (PAYMENT + USD)", () => {
    const body = buildEximbayReadyRequestBody({
      mid: "1849705C64",
      orderId: "su-order-1",
      amountUsdMinor: 100,
      buyerName: "eximbay",
      buyerEmail: "test@eximbay.com",
      lang: "EN",
      returnUrl: "https://example.com/simplyur/en/checkout/eximbay-return",
      statusUrl: "https://example.com/api/simplyur/webhooks/eximbay",
    });
    expect(body.payment.transaction_type).toBe("PAYMENT");
    expect(body.payment.currency).toBe("USD");
    expect(body.payment.amount).toBe("1");
    expect(body.payment.order_id).toBe("su-order-1");
    expect(body.merchant.mid).toBe("1849705C64");
    expect(body.buyer.email).toBe("test@eximbay.com");
    expect(body.url.return_url).toContain("eximbay-return");
    expect(body.url.status_url).toContain("/api/simplyur/webhooks/eximbay");
  });

  it("parseEximbayStatusQuery reads order_id and transaction_id", () => {
    const parsed = parseEximbayStatusQuery("rescode=0000&order_id=SU-123&transaction_id=tx9");
    expect(parsed.orderId).toBe("SU-123");
    expect(parsed.transactionId).toBe("tx9");
    expect(parsed.rescode).toBe("0000");
  });

  it("isSimplyurEximbayLiveEnabled when MID+API key set", () => {
    const prevMid = process.env.EXIMBAY_MID;
    const prevKey = process.env.EXIMBAY_API_KEY;
    process.env.EXIMBAY_MID = "1849705C64";
    process.env.EXIMBAY_API_KEY = "test_key";
    expect(isSimplyurEximbayLiveEnabled()).toBe(true);
    if (prevMid === undefined) delete process.env.EXIMBAY_MID;
    else process.env.EXIMBAY_MID = prevMid;
    if (prevKey === undefined) delete process.env.EXIMBAY_API_KEY;
    else process.env.EXIMBAY_API_KEY = prevKey;
  });
});
