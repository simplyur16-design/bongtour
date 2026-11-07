import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();

vi.mock("@/lib/bongsim/db/pool", () => ({
  getBongsimFulfillOutboxPool: () => ({ query }),
}));

import { releaseHeldEsimQrNotify } from "@/lib/bongsim/admin/esim-qr-notify-hold-admin";

describe("release held esim qr notify", () => {
  beforeEach(() => {
    query.mockReset();
  });

  it("returns a held row to the queue without marking it processed", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: "row-1" }] });
    const released = await releaseHeldEsimQrNotify("row-1");
    expect(released).toBe(true);
    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain("payload - '_outbox_hold'");
    expect(sql).toContain("processed_at IS NULL");
    expect(sql).not.toContain("processed_at = now()");
  });
});
