/**
 * 환불 3단계 순서: 접수 → 유심사 → PG (processRefund 통합, 외부 API 목)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/bongsim/refund/usimsa-refund-usage", () => ({
  checkUsimsaOrderDataUsageForRefund: vi.fn().mockResolvedValue({ ok: true, totalUsedMb: 0 }),
}));

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

type OrderRow = {
  order_id: string;
  status: string;
  grand_total_krw: string;
  payment_provider: string;
  payment_reference: string;
};

function orderRow(orderId: string, status: string, total = "10000"): OrderRow {
  return {
    order_id: orderId,
    status,
    grand_total_krw: total,
    payment_provider: "welcomepay",
    payment_reference: "TID-MOCK-001",
  };
}

function makeClient() {
  const client = {
    query: mockQuery,
    release: mockRelease,
  };
  mockConnect.mockResolvedValue(client);
  return client;
}

function queueQueries(handlers: Array<(sql: string) => { rows: Record<string, unknown>[] }>) {
  let i = 0;
  mockQuery.mockImplementation(async (sql: string) => {
    const s = String(sql).trim();
    if (s === "BEGIN" || s === "COMMIT" || s === "ROLLBACK") {
      return { rows: [] };
    }
    const fn = handlers[i];
    if (!fn) throw new Error(`unexpected query[${i}]: ${s.slice(0, 160)}`);
    i += 1;
    return fn(sql);
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
      // phase 1
      () => ({ rows: [orderRow(orderId, "paid")] }),
      () => ({ rows: [{ payment_attempt_id: "pa-1" }] }),
      () => ({ rows: [] }),
      () => ({ rows: [] }),
      // phase 2
      () => ({ rows: [{ ok: false }] }),
      () => ({ rows: [{ topup_id: "topup-a" }] }),
      () => ({ rows: [orderRow(orderId, "refund_requested")] }),
      () => ({ rows: [{ ok: false }] }),
      () => ({ rows: [] }),
      () => ({ rows: [{ payment_attempt_id: "pa-1" }] }),
      () => ({ rows: [] }),
      // phase 3
      () => ({ rows: [orderRow(orderId, "refund_requested")] }),
      () => ({ rows: [orderRow(orderId, "refund_requested")] }),
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
      // phase 1
      () => ({ rows: [orderRow(orderId, "delivered", "5000")] }),
      () => ({ rows: [{ payment_attempt_id: null }] }),
      () => ({ rows: [] }),
      () => ({ rows: [] }),
      // phase 2 (no topups)
      () => ({ rows: [{ ok: false }] }),
      () => ({ rows: [] }),
      () => ({ rows: [orderRow(orderId, "refund_requested", "5000")] }),
      () => ({ rows: [{ ok: false }] }),
      () => ({ rows: [{ payment_attempt_id: null }] }),
      () => ({ rows: [] }),
      // phase 3
      () => ({ rows: [orderRow(orderId, "refund_requested", "5000")] }),
      () => ({ rows: [orderRow(orderId, "refund_requested", "5000")] }),
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
