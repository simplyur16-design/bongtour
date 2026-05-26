/**
 * 환불 3단계 순서: 접수 → 유심사 → PG (processRefund 통합, 외부 API 목)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockQuery = vi.fn();
const mockConnect = vi.fn();
const mockRelease = vi.fn();

vi.mock("@/lib/bongsim/db/pool", () => ({
  getPgPool: () => ({
    connect: mockConnect,
  }),
}));

const cancelUsimsaTopup = vi.fn();
vi.mock("@/lib/bongsim/supplier/usimsa/order-api", () => ({
  cancelUsimsaTopup: (...args: unknown[]) => cancelUsimsaTopup(...args),
  UsimsaCancelError: class UsimsaCancelError extends Error {
    code = "MOCK";
    topupId = "";
  },
}));

const requestWelcomepayFullCancel = vi.fn();
vi.mock("@/lib/bongsim/welcomepay-payapi-cancel", () => ({
  buildWelcomepayCancelFormBody: () => ({ timestamp: "1234567890", mid: "mid", tid: "tid" }),
  requestWelcomepayFullCancel: (...args: unknown[]) => requestWelcomepayFullCancel(...args),
  resolveWelcomepaySignKey: () => "test_sign_key",
  welcomepayCancelFailMessage: () => "PG mock fail",
}));

vi.mock("@/lib/bongsim/refund/resolve-welcomepay-capture-tid", () => ({
  resolveWelcomepayCaptureTid: vi.fn().mockResolvedValue("TID-MOCK-001"),
}));

vi.mock("@/lib/bongsim/refund/notify-refund-completed", () => ({
  notifyRefundCompletedBestEffort: vi.fn().mockResolvedValue(undefined),
}));

import { processRefund } from "@/lib/bongsim/refund/process-refund";

type QueryResult = { rows: Record<string, unknown>[] };

function makeClient() {
  const client = {
    query: mockQuery,
    release: mockRelease,
  };
  mockConnect.mockResolvedValue(client);
  return client;
}

function queueQueries(handlers: Array<(sql: string, params?: unknown[]) => QueryResult | Promise<QueryResult>>) {
  let i = 0;
  mockQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
    const s = String(sql).trim();
    if (s === "BEGIN" || s === "COMMIT" || s === "ROLLBACK") {
      return { rows: [] };
    }
    const fn = handlers[i];
    if (!fn) throw new Error(`unexpected query[${i}]: ${s.slice(0, 120)}`);
    i += 1;
    return fn(sql, params);
  });
}

describe("processRefund 3-phase order", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WELCOMEPAY_MID = "test_mid";
    process.env.WELCOMEPAY_SIGN_KEY = "test_sign_key";
    cancelUsimsaTopup.mockResolvedValue({ code: "0000", message: "ok" });
    requestWelcomepayFullCancel.mockResolvedValue({
      ok: true,
      httpStatus: 200,
      api: "payapi_cancel",
      parsed: { ResultCode: "00" },
      raw: "ok",
      resultCode: "00",
      resultMsg: "",
    });
  });

  it("calls USIMSA cancel before Welcomepay PG cancel", async () => {
    const orderId = "11111111-1111-1111-1111-111111111111";
    const callOrder: string[] = [];

    cancelUsimsaTopup.mockImplementation(async () => {
      callOrder.push("usimsa");
      return { code: "0000", message: "ok" };
    });
    requestWelcomepayFullCancel.mockImplementation(async () => {
      callOrder.push("pg");
      return {
        ok: true,
        httpStatus: 200,
        api: "payapi_cancel",
        parsed: {},
        raw: "ok",
        resultCode: "00",
        resultMsg: "",
      };
    });

    queueQueries([
      () => ({
        rows: [
          {
            order_id: orderId,
            status: "paid",
            grand_total_krw: "10000",
            payment_provider: "welcomepay",
            payment_reference: "TID-MOCK-001",
          },
        ],
      }),
      () => ({ rows: [{ ok: false }] }),
      () => ({ rows: [{ payment_attempt_id: "pa-1" }] }),
      () => ({ rows: [] }),
      () => ({ rows: [] }),
      () => ({ rows: [{ ok: false }] }),
      () => ({ rows: [{ topup_id: "topup-a" }] }),
      () => ({
        rows: [
          {
            order_id: orderId,
            status: "refund_requested",
            grand_total_krw: "10000",
            payment_provider: "welcomepay",
            payment_reference: "TID-MOCK-001",
          },
        ],
      }),
      () => ({ rows: [{ ok: false }] }),
      () => ({ rows: [] }),
      () => ({ rows: [{ payment_attempt_id: "pa-1" }] }),
      () => ({ rows: [] }),
      () => ({
        rows: [
          {
            order_id: orderId,
            status: "refund_requested",
            grand_total_krw: "10000",
            payment_provider: "welcomepay",
            payment_reference: "TID-MOCK-001",
          },
        ],
      }),
      () => ({
        rows: [
          {
            order_id: orderId,
            status: "refund_requested",
            grand_total_krw: "10000",
            payment_provider: "welcomepay",
            payment_reference: "TID-MOCK-001",
          },
        ],
      }),
      () => ({ rows: [{ payment_attempt_id: "pa-1" }] }),
      () => ({ rows: [] }),
      () => ({ rows: [] }),
      () => ({ rows: [] }),
    ]);

    makeClient();
    const result = await processRefund(orderId, "test", { kind: "admin", id: "test" });

    expect(result).toEqual({ ok: true });
    expect(callOrder).toEqual(["usimsa", "pg"]);
    expect(cancelUsimsaTopup).toHaveBeenCalledWith("topup-a");
    expect(requestWelcomepayFullCancel).toHaveBeenCalledTimes(1);
  });

  it("on PG failure does not set order status to refunded", async () => {
    const orderId = "22222222-2222-2222-2222-222222222222";
    requestWelcomepayFullCancel.mockResolvedValue({
      ok: false,
      httpStatus: 200,
      api: {},
      parsed: { resultCode: "01" },
      raw: "fail",
    });

    queueQueries([
      () => ({
        rows: [
          {
            order_id: orderId,
            status: "delivered",
            grand_total_krw: "5000",
            payment_provider: "welcomepay",
            payment_reference: "TID-MOCK-001",
          },
        ],
      }),
      () => ({ rows: [{ ok: false }] }),
      () => ({ rows: [{ payment_attempt_id: null }] }),
      () => ({ rows: [] }),
      () => ({ rows: [] }),
      () => ({ rows: [{ ok: false }] }),
      () => ({ rows: [] }),
      () => ({
        rows: [
          {
            order_id: orderId,
            status: "refund_requested",
            grand_total_krw: "5000",
            payment_provider: "welcomepay",
            payment_reference: "TID-MOCK-001",
          },
        ],
      }),
      () => ({ rows: [{ ok: false }] }),
      () => ({ rows: [{ payment_attempt_id: null }] }),
      () => ({ rows: [] }),
      () => ({
        rows: [
          {
            order_id: orderId,
            status: "refund_requested",
            grand_total_krw: "5000",
            payment_provider: "welcomepay",
            payment_reference: "TID-MOCK-001",
          },
        ],
      }),
      () => ({
        rows: [
          {
            order_id: orderId,
            status: "refund_requested",
            grand_total_krw: "5000",
            payment_provider: "welcomepay",
            payment_reference: "TID-MOCK-001",
          },
        ],
      }),
      () => ({ rows: [{ payment_attempt_id: null }] }),
      () => ({ rows: [] }),
    ]);

    makeClient();
    const result = await processRefund(orderId, "test", { kind: "customer" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("pg_cancel_failed");
    const refundedUpdates = mockQuery.mock.calls.filter(
      ([sql]) => typeof sql === "string" && sql.includes("status = 'refunded'"),
    );
    expect(refundedUpdates).toHaveLength(0);
  });
});
