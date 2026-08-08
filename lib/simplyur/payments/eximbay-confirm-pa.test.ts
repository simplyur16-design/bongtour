import { describe, expect, it } from "vitest";
import { buildEximbayConfirmPaBody } from "@/lib/simplyur/payments/eximbay-confirm-pa";
import {
  isEximbayPayerAuthStatus,
  parseEximbayStatusQuery,
} from "@/lib/simplyur/payments/eximbay-verify";

describe("simplyur Eximbay PAYER_AUTH → confirm", () => {
  // REGRESSION-FREEZE[simplyur-eximbay-payer-auth-pa]
  it("buildEximbayConfirmPaBody shapes PAYMENT_PA body", () => {
    const body = buildEximbayConfirmPaBody({
      mid: "1849705C64",
      orderId: "SU-1",
      amountUsd: "1.50",
      payerAuthId: "PAUTH123",
      lang: "EN",
    });
    expect(body.transaction_type).toBe("PAYMENT_PA");
    expect(body.payment.payer_auth_id).toBe("PAUTH123");
    expect(body.payment.amount).toBe("1.50");
    expect(body.payment.currency).toBe("USD");
  });

  it("detects PAYER_AUTH status without marking paid", () => {
    const parsed = parseEximbayStatusQuery(
      "rescode=0000&order_id=SU-1&txntype=PAYER_AUTH&payer_auth_id=PA1",
    );
    expect(parsed.payerAuthId).toBe("PA1");
    expect(isEximbayPayerAuthStatus(parsed)).toBe(true);
  });

  it("does not treat full payment status as auth-only", () => {
    const parsed = parseEximbayStatusQuery(
      "rescode=0000&order_id=SU-1&transaction_id=TX9&payer_auth_id=PA1&txntype=PAYMENT",
    );
    expect(isEximbayPayerAuthStatus(parsed)).toBe(false);
  });
});
