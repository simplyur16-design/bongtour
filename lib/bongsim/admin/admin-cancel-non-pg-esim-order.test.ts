/**
 * REGRESSION-FREEZE[bongsim-admin-non-pg-esim-cancel]
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();
const release = vi.fn();
const connect = vi.fn(async () => ({ query, release }));

vi.mock("@/lib/bongsim/db/pool", () => ({
  getPgPool: () => ({ connect }),
}));

vi.mock("@/lib/bongsim/refund/usimsa-refund-usage", () => ({
  checkUsimsaOrderDataUsageForRefund: vi.fn(),
}));

vi.mock("@/lib/bongsim/fulfillment/esim-qr-notify-outbox", () => ({
  terminalPendingEsimQrNotifyForOrder: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/lib/bongsim/supplier/usimsa/order-api", () => ({
  cancelUsimsaTopup: vi.fn(),
  cancelUsimsaUsimTopup: vi.fn(),
  UsimsaCancelError: class UsimsaCancelError extends Error {
    code: string;
    constructor(topupId: string, code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

import { checkUsimsaOrderDataUsageForRefund } from "@/lib/bongsim/refund/usimsa-refund-usage";
import { cancelUsimsaTopup } from "@/lib/bongsim/supplier/usimsa/order-api";
import { adminCancelNonPgEsimOrder } from "@/lib/bongsim/admin/admin-cancel-non-pg-esim-order";

describe("adminCancelNonPgEsimOrder", () => {
  beforeEach(() => {
    query.mockReset();
    release.mockReset();
    connect.mockClear();
    vi.mocked(checkUsimsaOrderDataUsageForRefund).mockReset();
    vi.mocked(cancelUsimsaTopup).mockReset();
  });

  it("rejects welcomepay orders", async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          order_id: "o1",
          status: "delivered",
          payment_provider: "welcomepay",
          consents: {},
        },
      ],
    });
    const r = await adminCancelNonPgEsimOrder("o1", "test", "admin");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not_non_pg_order");
  });

  it("cancels complimentary order without PG", async () => {
    vi.mocked(checkUsimsaOrderDataUsageForRefund).mockResolvedValue({ ok: true });
    vi.mocked(cancelUsimsaTopup).mockResolvedValue({ code: "0000", message: "ok" });

    query
      .mockResolvedValueOnce({
        rows: [
          {
            order_id: "4a44a9c5-8cff-4f81-9913-62bf4ae748db",
            status: "delivered",
            payment_provider: "complimentary",
            consents: {
              complimentary_esim: {
                fulfillment: "complimentary_esim",
                created_by_admin_id: "a",
                created_at: "2026-07-13T00:00:00.000Z",
                granted_by_admin_id: "a",
                granted_at: "2026-07-13T00:00:00.000Z",
                reason_category: "customer_thanks",
                reason_memo: "thanks",
              },
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ topup_id: "202607131256561918169467", fulfillment_mode: "esim" }],
      })
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // topup update
      .mockResolvedValueOnce({ rows: [] }) // order refunded
      .mockResolvedValueOnce({ rows: [] }) // payment attempt
      .mockResolvedValueOnce({ rows: [{ payment_attempt_id: "pa1" }] })
      .mockResolvedValueOnce({ rows: [] }) // event insert
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const r = await adminCancelNonPgEsimOrder(
      "4a44a9c5-8cff-4f81-9913-62bf4ae748db",
      "테스트 취소",
      "admin1",
    );
    expect(r).toEqual({ ok: true, canceled_topup_ids: ["202607131256561918169467"] });
    expect(cancelUsimsaTopup).toHaveBeenCalledWith("202607131256561918169467");
  });
});
