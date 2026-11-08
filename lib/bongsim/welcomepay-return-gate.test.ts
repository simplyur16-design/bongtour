import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isWelcomepayAuthSuccessCode } from "@/lib/bongsim/checkout/welcomepay-fail-message";
import { isWelcomepayReturnAmountTampered } from "@/lib/bongsim/welcomepay-callback-parse";
import { verifyWelcomepayAuthSignature } from "@/lib/bongsim/welcomepay-payauth";

function authSignatureFor(input: {
  mid: string;
  authTimestamp: string;
  moid: string;
  totPrice: string;
}): string {
  const plain = `TotPrice=${input.totPrice}&tstamp=${input.authTimestamp}&MOID=${input.moid}`;
  return createHash("sha256").update(plain, "utf8").digest("hex");
}

describe("welcomepay return auth and amount gate", () => {
  it("rejects a non-success auth result code", () => {
    expect(isWelcomepayAuthSuccessCode("01")).toBe(false);
    expect(isWelcomepayAuthSuccessCode("0000")).toBe(true);
  });

  it("rejects a tampered authSignature", () => {
    const input = {
      mid: "testmid",
      authTimestamp: "202611081210100",
      moid: "oid-fixture",
      totPrice: "8910",
    };
    expect(
      verifyWelcomepayAuthSignature({
        ...input,
        authSignature: authSignatureFor(input),
      }),
    ).toBe(true);
    expect(
      verifyWelcomepayAuthSignature({
        ...input,
        authSignature: "0".repeat(64),
      }),
    ).toBe(false);
  });

  it("rejects a callback amount that differs from the order total", () => {
    expect(isWelcomepayReturnAmountTampered(1, 8910)).toBe(true);
    expect(isWelcomepayReturnAmountTampered(8910, 8910)).toBe(false);
    expect(isWelcomepayReturnAmountTampered(null, 8910)).toBe(false);
  });
});
