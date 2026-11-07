import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const query = vi.fn();
const connect = vi.fn();

vi.mock("@/lib/bongsim/db/pool", () => ({
  getPgPool: () => ({ query, connect }),
  classifyBongsimPgError: () => "other",
  healBongsimPgPoolForCatalog: async () => {},
}));

import { adminGrantComplimentaryEsim } from "@/lib/bongsim/admin/complimentary-esim-order";

describe("complimentary grant idempotency", () => {
  beforeEach(() => {
    query.mockReset();
    connect.mockReset();
  });

  it("reuses the existing order for the same idempotency key and does not enqueue again", async () => {
    query.mockResolvedValueOnce({
      rows: [{ order_id: "order-existing", order_number: "BS-TEST-1", idempotency_key: "grant-key-1" }],
    });
    const result = await adminGrantComplimentaryEsim({
      option_api_id: "opt-1",
      quantity: 1,
      buyer_phone: "010-0000-0000",
      reason_category: "cs_compensation",
      reason_memo: "retry",
      admin_id: "admin-1",
      idempotency_key: "grant-key-1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.idempotent_replay).toBe(true);
    expect(result.fulfillment_started).toBe(false);
    expect(result.order.order_id).toBe("order-existing");
    expect(result.order.totals.grand_total_krw).toBe(0);
    expect(connect).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(1);
  });
});
