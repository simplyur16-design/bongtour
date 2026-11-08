import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const outcome = vi.fn();

vi.mock("@/lib/bongsim/db/pool", () => ({
  getPgPool: () => ({
    connect: async () => ({
      query: async () => ({
        rows: [
          {
            payment_attempt_id: "attempt-1",
            order_id: "order-1",
            grand_total_krw: "8910",
            order_number: "BT-FIXTURE",
          },
        ],
      }),
      release: () => {},
    }),
  }),
}));

vi.mock("@/lib/bongsim/data/process-welcomepay-payment-outcome", () => ({
  WELCOMEPAY_PROVIDER_ID: "welcomepay",
  processWelcomepayPaymentOutcome: (...args: unknown[]) => outcome(...args),
}));

import { POST } from "@/app/api/bongsim/checkout/welcomepay-return/route";

const TID = "WPTESTTID1234567890AB";

function callbackRequest(fields: Record<string, string>): Request {
  const body = new URLSearchParams(fields);
  return new Request("https://bongtour.test/api/bongsim/checkout/welcomepay-return", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
}

function locationMessage(res: Response): string {
  const loc = res.headers.get("location") ?? "";
  return new URL(loc).searchParams.get("message") ?? "";
}

describe("welcomepay return callback rejections", () => {
  afterEach(() => {
    outcome.mockReset();
    vi.unstubAllGlobals();
  });

  it("auth failure does not capture or call the payment gateway", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(
      callbackRequest({
        oid: "oid-fixture",
        resultCode: "01",
        authToken: "token-fixture",
        mid: "testmid",
      }),
    );
    expect(res.status).toBe(303);
    expect(locationMessage(res).length).toBeGreaterThan(0);
    expect(new URL(res.headers.get("location") ?? "").searchParams.get("status")).toBe("fail");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(outcome).not.toHaveBeenCalled();
  });

  it("rejects a mismatched authSignature before capture", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            resultCode: "0000",
            authSignature: "0".repeat(64),
            TotPrice: "8910",
            tid: TID,
            MOID: "oid-fixture",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    const res = await POST(
      callbackRequest({
        oid: "oid-fixture",
        resultCode: "0000",
        authToken: "token-fixture",
        mid: "testmid",
        authUrl: "http://localhost/mock-payauth",
      }),
    );
    expect(res.status).toBe(303);
    expect(locationMessage(res)).toBe("auth_signature_mismatch");
    expect(outcome).not.toHaveBeenCalled();
  });

  it("rejects a tampered callback amount before capture", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            resultCode: "0000",
            TotPrice: "1",
            tid: TID,
            MOID: "oid-fixture",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    const res = await POST(
      callbackRequest({
        oid: "oid-fixture",
        resultCode: "0000",
        authToken: "token-fixture",
        mid: "testmid",
        authUrl: "http://localhost/mock-payauth",
      }),
    );
    expect(res.status).toBe(303);
    expect(locationMessage(res)).toBe("amount_mismatch");
    expect(outcome).not.toHaveBeenCalled();
  });
});
