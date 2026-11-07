import { afterEach, describe, expect, it } from "vitest";
import { toHeldEsimQrNotifyRow } from "@/lib/bongsim/admin/esim-qr-notify-hold-admin";
import {
  ESIM_QR_NOTIFY_FRESH_PENDING_SQL,
  ESIM_QR_NOTIFY_TICK_SEND_CAP,
  esimQrNotifyHoldAfterHours,
  esimQrNotifyPendingCountSql,
  esimQrNotifyRowNeedsAgeHold,
  isEsimQrNotifyDryRun,
  maskEsimNotifyPhone,
} from "@/lib/bongsim/fulfillment/esim-qr-notify-policy";

describe("esim qr notify safeguards", () => {
  afterEach(() => {
    delete process.env.BONGSIM_ESIM_QR_NOTIFY_HOLD_AFTER_HOURS;
    delete process.env.BONGSIM_ESIM_QR_NOTIFY_DRY_RUN;
  });

  it("hold and dry-run stay off by default", () => {
    expect(esimQrNotifyHoldAfterHours()).toBeNull();
    expect(isEsimQrNotifyDryRun()).toBe(false);
    expect(ESIM_QR_NOTIFY_TICK_SEND_CAP).toBe(24);
  });

  it("pending count SQL excludes held and terminal rows and does not update", () => {
    const sql = esimQrNotifyPendingCountSql();
    expect(sql.startsWith("SELECT COUNT(*)::int AS n")).toBe(true);
    expect(sql).toContain(ESIM_QR_NOTIFY_FRESH_PENDING_SQL);
    expect(sql).toContain("payload->>'_enqueued_at'");
    expect(sql).not.toContain("UPDATE");
    expect(sql).not.toContain("jsonb_set");
  });

  it("does not hold a fresh stamped row when the age gate is on", () => {
    const now = Date.parse("2026-11-07T00:00:00.000Z");
    expect(
      esimQrNotifyRowNeedsAgeHold(
        {
          enqueuedAt: "2026-11-06T20:00:00.000Z",
          availableAtMs: now,
          held: false,
          terminal: false,
          processed: false,
        },
        48,
        now,
      ),
    ).toBe(false);
  });

  it("holds a legacy row with no enqueue time and an old stamped row", () => {
    const now = Date.parse("2026-11-07T00:00:00.000Z");
    expect(
      esimQrNotifyRowNeedsAgeHold(
        { enqueuedAt: null, availableAtMs: now, held: false, terminal: false, processed: false },
        48,
        now,
      ),
    ).toBe(true);
    expect(
      esimQrNotifyRowNeedsAgeHold(
        {
          enqueuedAt: "2026-11-01T00:00:00.000Z",
          availableAtMs: now,
          held: false,
          terminal: false,
          processed: false,
        },
        48,
        now,
      ),
    ).toBe(true);
    expect(
      esimQrNotifyRowNeedsAgeHold(
        { enqueuedAt: null, availableAtMs: now, held: true, terminal: false, processed: false },
        48,
        now,
      ),
    ).toBe(false);
  });

  it("lists a held row with a masked phone only", () => {
    const row = toHeldEsimQrNotifyRow({
      id: "row-1",
      payload: {
        order_id: "order-1",
        delivery_phone: "01000000000",
        _outbox_hold: { active: true, held_at: "2026-11-01T00:00:00.000Z" },
        _outbox_defer: { attempts: 3 },
      },
    });
    expect(row.masked_phone).toBe(maskEsimNotifyPhone("01000000000"));
    expect(row.masked_phone).toBe("***0000");
    expect(JSON.stringify(row)).not.toContain("01000000000");
    expect(row.order_id).toBe("order-1");
  });

  it("reads the hold age only when the env is a positive integer", () => {
    process.env.BONGSIM_ESIM_QR_NOTIFY_HOLD_AFTER_HOURS = "48";
    expect(esimQrNotifyHoldAfterHours()).toBe(48);
    process.env.BONGSIM_ESIM_QR_NOTIFY_DRY_RUN = "1";
    expect(isEsimQrNotifyDryRun()).toBe(true);
  });
});
