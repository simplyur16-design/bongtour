import { describe, expect, it } from "vitest";
import {
  buildEximbayCancelBody,
  callEximbayPaymentsCancel,
} from "@/lib/simplyur/payments/eximbay-cancel";

// REGRESSION-FREEZE[simplyur-eximbay-refund]: cancel body + API — manifest

describe("eximbay-cancel", () => {
  it("buildEximbayCancelBody builds full-cancel payload", () => {
    const body = buildEximbayCancelBody({
      mid: "1849705C64",
      transactionOrderId: "SU-ORDER-1",
      amountUsd: "12.50",
      refundId: "rf_abc",
      reason: "Unused eSIM",
    });
    expect(body.refund.refund_type).toBe("F");
    expect(body.refund.refund_amount).toBe("12.50");
    expect(body.payment.currency).toBe("USD");
    expect(body.payment.balance).toBe("12.50");
    expect(body.payment.order_id).toBe("SU-ORDER-1");
  });

  it("callEximbayPaymentsCancel posts to /v1/payments/{id}/cancel", async () => {
    const calls: { url: string; body: string }[] = [];
    const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), body: String(init?.body ?? "") });
      return new Response(
        JSON.stringify({
          rescode: "0000",
          resmsg: "Success",
          refund: { refund_transaction_id: "RF-TX-1" },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const prev = {
      EXIMBAY_ENV: process.env.EXIMBAY_ENV,
      EXIMBAY_MID: process.env.EXIMBAY_MID,
      EXIMBAY_API_KEY: process.env.EXIMBAY_API_KEY,
    };
    process.env.EXIMBAY_ENV = "test";
    process.env.EXIMBAY_MID = "";
    process.env.EXIMBAY_API_KEY = "";

    try {
      const body = buildEximbayCancelBody({
        mid: "1849705C64",
        transactionOrderId: "SU-1",
        amountUsd: "1.00",
        refundId: "rf1",
        reason: "test",
      });
      const r = await callEximbayPaymentsCancel("TX-99", body, fetchImpl);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.refundTransactionId).toBe("RF-TX-1");
      expect(calls[0]?.url).toContain("/v1/payments/TX-99/cancel");
      expect(calls[0]?.url).toContain("api-test.eximbay.com");
    } finally {
      process.env.EXIMBAY_ENV = prev.EXIMBAY_ENV;
      process.env.EXIMBAY_MID = prev.EXIMBAY_MID;
      process.env.EXIMBAY_API_KEY = prev.EXIMBAY_API_KEY;
    }
  });
});
