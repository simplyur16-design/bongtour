import { beforeEach, describe, expect, it, vi } from "vitest";

type Outbox = {
  id: string;
  topic: string;
  payload: Record<string, unknown>;
  dedupe_key: string;
  available_at: Date;
  locked_at: Date | null;
  processed_at: Date | null;
};

const state = {
  orderStatus: "awaiting_payment",
  attemptStatus: "redirected",
  events: new Set<string>(),
  outbox: [] as Outbox[],
  seq: 1,
  issueAttempts: 0,
  issueSuccess: 0,
  solapiAttempts: 0,
  solapiSuccess: 0,
  issueShouldFail: false,
  solapiShouldFail: false,
};

function freshOutbox(topic: string, payload: Record<string, unknown>, dedupe: string): Outbox {
  return {
    id: `ob-${state.seq++}`,
    topic,
    payload,
    dedupe_key: dedupe,
    available_at: new Date(Date.now() - 1000),
    locked_at: null,
    processed_at: null,
  };
}

const fakePool = {
  async query(sql: string, params: unknown[] = []) {
    const text = sql.replace(/\s+/g, " ");
    if (text.startsWith("BEGIN") || text.startsWith("COMMIT") || text.startsWith("ROLLBACK")) {
      return { rows: [] };
    }
    if (text.includes("FROM bongsim_payment_attempt") && text.includes("payment_attempt_id = $1")) {
      return {
        rows: [
          {
            payment_attempt_id: "attempt-1",
            order_id: "order-1",
            status: state.attemptStatus,
            amount_krw: "8910",
            provider: "welcomepay",
          },
        ],
      };
    }
    if (text.includes("FROM bongsim_order") && text.includes("grand_total_krw")) {
      return { rows: [{ order_id: "order-1", status: state.orderStatus, grand_total_krw: "8910" }] };
    }
    if (text.includes("INSERT INTO bongsim_payment_provider_event")) {
      const eventId = String(params[1]);
      if (state.events.has(eventId)) return { rows: [] };
      state.events.add(eventId);
      return { rows: [{ id: "evt-1" }] };
    }
    if (text.includes("UPDATE bongsim_payment_attempt SET status")) {
      state.attemptStatus = String(params[1]);
      return { rows: [] };
    }
    if (text.includes("UPDATE bongsim_payment_attempt") && text.includes("last_error")) {
      return { rows: [] };
    }
    if (text.includes("UPDATE bongsim_order") && text.includes("status = 'paid'")) {
      state.orderStatus = "paid";
      return { rows: [] };
    }
    if (text.includes("WITH pending") && text.includes("INSERT INTO bongsim_outbox")) {
      const topic = String(params[0]);
      const dedupe = String(params[2]);
      const existing = state.outbox.find((row) => row.dedupe_key === dedupe);
      const payload = JSON.parse(String(params[1])) as Record<string, unknown>;
      if (existing) return { rows: [{ id: existing.id }] };
      const row = freshOutbox(topic, payload, dedupe);
      state.outbox.push(row);
      return { rows: [{ id: row.id }] };
    }
    if (text.includes("INSERT INTO bongsim_outbox")) {
      const topic = String(params[0]);
      const dedupe = String(params[2]);
      if (state.outbox.some((row) => row.dedupe_key === dedupe)) return { rows: [] };
      const payload = JSON.parse(String(params[1])) as Record<string, unknown>;
      state.outbox.push(freshOutbox(topic, payload, dedupe));
      return { rows: [{ id: "inserted" }] };
    }
    if (text.includes("FROM bongsim_order WHERE order_id = $1") && text.includes("SELECT status")) {
      return { rows: [{ status: state.orderStatus }] };
    }
    if (text.includes("topic = 'OrderPaid'") && text.includes("FOR UPDATE")) {
      const due = state.outbox.filter(
        (row) => row.topic === "OrderPaid" && row.processed_at == null && row.available_at.getTime() <= Date.now(),
      );
      return { rows: due.slice(0, 1) };
    }
    if (text.includes("SET locked_at = now()") && text.includes("interval '2 minutes'")) {
      const row = state.outbox.find((item) => item.id === params[0]);
      if (row) {
        row.locked_at = new Date();
        row.available_at = new Date(Date.now() + 120_000);
      }
      return { rows: [] };
    }
    if (text.includes("SET processed_at = now()") && text.includes("WHERE id = $1 AND processed_at IS NULL")) {
      const row = state.outbox.find((item) => item.id === params[0]);
      if (row && row.processed_at == null) row.processed_at = new Date();
      return { rows: [] };
    }
    if (text.includes("INSERT INTO bongsim_outbox") && text.includes("EsimQrNotify")) {
      const dedupe = String(params[2]);
      const existing = state.outbox.find((row) => row.dedupe_key === dedupe);
      const payload = JSON.parse(String(params[1])) as Record<string, unknown>;
      if (existing) return { rows: [{ id: existing.id }] };
      const row = freshOutbox("EsimQrNotify", payload, dedupe);
      state.outbox.push(row);
      return { rows: [{ id: row.id }] };
    }
    if (text.includes("UPDATE bongsim_outbox") && text.includes("{_outbox_hold}")) {
      for (const row of state.outbox) {
        if (row.topic !== "EsimQrNotify" || row.processed_at) continue;
        const hold = row.payload._outbox_hold as { active?: boolean } | undefined;
        if (hold?.active) continue;
        const terminal = (row.payload._outbox_defer as { terminal?: boolean } | undefined)?.terminal === true;
        if (terminal) continue;
        if (row.payload._enqueued_at) continue;
        row.payload = {
          ...row.payload,
          _outbox_hold: { active: true, reason: "age", held_at: new Date().toISOString() },
        };
      }
      return { rows: [] };
    }
    if (text.includes("interval '1 minute'") || text.includes("interval '1 second'")) {
      const row = state.outbox.find((item) => item.id === params[0]);
      if (row) {
        row.available_at = new Date(Date.now() - 500);
        const raw = params[params.length - 1];
        if (typeof raw === "string") row.payload = JSON.parse(raw) as Record<string, unknown>;
      }
      return { rows: [] };
    }
    if (text.trim().startsWith("SELECT COUNT(*)::int AS n") && text.includes("bongsim_outbox")) {
      const n = state.outbox.filter((row) => {
        if (row.topic !== "EsimQrNotify" || row.processed_at) return false;
        const hold = row.payload._outbox_hold as { active?: boolean } | undefined;
        if (hold?.active) return false;
        const terminal = (row.payload._outbox_defer as { terminal?: boolean } | undefined)?.terminal;
        if (terminal) return false;
        return true;
      }).length;
      return { rows: [{ n }] };
    }
    if (text.includes("FROM bongsim_outbox") && text.includes("FOR UPDATE SKIP LOCKED")) {
      const due = state.outbox.filter((row) => {
        if (row.topic !== params[0] || row.processed_at) return false;
        if (row.available_at.getTime() > Date.now()) return false;
        const hold = row.payload._outbox_hold as { active?: boolean } | undefined;
        if (hold?.active) return false;
        return true;
      });
      return { rows: due.slice(0, 1).map((row) => ({ id: row.id, payload: row.payload })) };
    }
    if (text.includes("SET locked_at = now()") && text.includes("interval '1 millisecond'")) {
      const row = state.outbox.find((item) => item.id === params[0]);
      if (row) {
        row.locked_at = new Date();
        row.available_at = new Date(Date.now() + 900_000);
      }
      return { rows: [] };
    }
    if (text.includes("SET locked_at = NULL") && text.includes("processed_at IS NULL")) {
      const row = state.outbox.find((item) => item.id === params[0]);
      if (row && row.processed_at == null) {
        row.locked_at = null;
        row.available_at = new Date();
      }
      return { rows: [] };
    }
    if (text.includes("SET processed_at = now(), locked_at = now() WHERE id = $1")) {
      const row = state.outbox.find((item) => item.id === params[0]);
      if (row) row.processed_at = new Date();
      return { rows: [] };
    }
    if (text.includes("SET available_at = now() +") && text.includes("_outbox_defer")) {
      const row = state.outbox.find((item) => item.id === params[0]);
      if (row) {
        row.available_at = new Date(Date.now() - 500);
        row.payload = JSON.parse(String(params[2])) as Record<string, unknown>;
      }
      return { rows: [] };
    }
    if (text.includes("SELECT status FROM bongsim_order WHERE order_id")) {
      return { rows: [{ status: "paid" }] };
    }
    throw new Error(`unhandled sql: ${text.slice(0, 180)}`);
  },
  async connect() {
    return fakePool;
  },
  release() {},
};

vi.mock("@/lib/bongsim/db/pool", () => ({
  getPgPool: () => fakePool,
  getBongsimFulfillOutboxPool: () => fakePool,
  healBongsimPgPoolForCatalog: async () => {},
  classifyBongsimPgError: () => "other",
}));

vi.mock("@/lib/bongsim/data/bongsim-coupon", () => ({
  recordBongsimCouponUsageAfterCapture: async () => {},
}));

vi.mock("@/lib/bongsim/data/bongsim-order-paid-side-effects", () => ({
  runBongsimOrderPaidSideEffects: async () => {},
}));

vi.mock("@/lib/bongsim/fulfillment/process-fulfillment-job", () => ({
  advanceFulfillmentForPaidOrderReleasingDuringSubmit: async (orderId: string) => {
    state.issueAttempts += 1;
    if (state.issueShouldFail) {
      state.issueShouldFail = false;
      throw new Error("usimsa_mock_fail");
    }
    state.issueSuccess += 1;
    const { enqueueEsimQrNotify } = await import("@/lib/bongsim/fulfillment/esim-qr-notify-outbox");
    await enqueueEsimQrNotify({
      order_id: orderId,
      order_number: "BS-TEST-0001",
      delivery_email: "buyer@example.com",
      delivery_phone: "01000000000",
      qr_code_url: "https://example.test/qr.png",
      download_link: "https://example.test/lpa",
    });
  },
}));

vi.mock("@/lib/bongsim/fulfillment/process-order-paid-outbox", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bongsim/fulfillment/process-order-paid-outbox")>();
  return { ...actual, ensureOrderPaidOutboxDrainAfterEnqueue: () => {} };
});

vi.mock("@/lib/bongsim/fulfillment/esim-delivery", () => ({
  maybeDeliverEsimAfterFulfillment: async () => {},
  sendQueuedEsimQrCustomerNotify: async () => {
    state.solapiAttempts += 1;
    if (state.solapiShouldFail) {
      state.solapiShouldFail = false;
      throw new Error("solapi_mock_fail");
    }
    state.solapiSuccess += 1;
  },
}));

vi.mock("@/lib/instrumentation-process-role", () => ({
  shouldDrainOrderPaidInThisProcess: () => true,
}));

import { processWelcomepayPaymentOutcome } from "@/lib/bongsim/data/process-welcomepay-payment-outcome";
import { processNextOrderPaidOutbox } from "@/lib/bongsim/fulfillment/process-order-paid-outbox";
import { processNextEsimQrNotifyOutbox } from "@/lib/bongsim/fulfillment/esim-qr-notify-outbox";

function notifyRows() {
  return state.outbox.filter((row) => row.topic === "EsimQrNotify");
}

async function payOnce(eventId = "pg-event-1") {
  return processWelcomepayPaymentOutcome({
    providerEventId: eventId,
    paymentAttemptId: "attempt-1",
    outcome: "captured",
    amountKrw: 8910,
    rawPayload: { synthetic: true },
  });
}

async function issueAndNotify() {
  const issued = await processNextOrderPaidOutbox();
  const sent = await processNextEsimQrNotifyOutbox();
  return { issued, sent };
}

describe("isolated esim paid to sms pipeline", () => {
  beforeEach(() => {
    state.orderStatus = "awaiting_payment";
    state.attemptStatus = "redirected";
    state.events.clear();
    state.outbox = [];
    state.seq = 1;
    state.issueAttempts = 0;
    state.issueSuccess = 0;
    state.solapiAttempts = 0;
    state.solapiSuccess = 0;
    state.issueShouldFail = false;
    state.solapiShouldFail = false;
    delete process.env.BONGSIM_ESIM_QR_NOTIFY_DRY_RUN;
    delete process.env.BONGSIM_ESIM_QR_NOTIFY_HOLD_AFTER_HOURS;
  });

  it("happy path pays, issues once, and sends Solapi once", async () => {
    const paid = await payOnce();
    expect(paid).toEqual({ ok: true, duplicate: false });
    expect(state.orderStatus).toBe("paid");
    expect(state.outbox.filter((row) => row.topic === "OrderPaid")).toHaveLength(1);
    const { issued, sent } = await issueAndNotify();
    expect(issued.outcome).toBe("processed");
    expect(sent.outcome).toBe("processed");
    expect(state.issueSuccess).toBe(1);
    expect(state.solapiSuccess).toBe(1);
    expect(notifyRows()[0]?.processed_at).toBeTruthy();
  });

  it("amount tamper does not mark paid, issue, or send SMS", async () => {
    const paid = await processWelcomepayPaymentOutcome({
      providerEventId: "pg-tamper-1",
      paymentAttemptId: "attempt-1",
      outcome: "captured",
      amountKrw: 1,
      rawPayload: { synthetic: true },
    });
    expect(paid).toEqual({ ok: false, reason: "amount_mismatch" });
    expect(state.orderStatus).toBe("awaiting_payment");
    expect(state.attemptStatus).toBe("redirected");
    expect(state.outbox).toHaveLength(0);
    expect(state.issueSuccess).toBe(0);
    expect(state.solapiSuccess).toBe(0);
  });

  it("duplicate callback keeps one paid transition, one issue, and one SMS", async () => {
    expect(await payOnce()).toEqual({ ok: true, duplicate: false });
    expect(await payOnce()).toEqual({ ok: true, duplicate: true });
    expect(state.outbox.filter((row) => row.topic === "OrderPaid")).toHaveLength(1);
    await issueAndNotify();
    await issueAndNotify();
    expect(state.issueSuccess).toBe(1);
    expect(state.solapiSuccess).toBe(1);
  });

  it("a second drain after success does not issue or send again", async () => {
    await payOnce();
    await issueAndNotify();
    await issueAndNotify();
    expect(state.issueSuccess).toBe(1);
    expect(state.solapiSuccess).toBe(1);
  });

  it("retries a failed USIMSA issue and a failed Solapi send only once each", async () => {
    await payOnce();
    state.issueShouldFail = true;
    const failedIssue = await processNextOrderPaidOutbox();
    expect(failedIssue.outcome).toBe("error");
    expect(state.issueSuccess).toBe(0);
    const issued = await processNextOrderPaidOutbox();
    expect(issued.outcome).toBe("processed");
    expect(state.issueSuccess).toBe(1);

    state.solapiShouldFail = true;
    const failedSms = await processNextEsimQrNotifyOutbox();
    expect(failedSms.outcome === "processed").toBe(false);
    expect(state.solapiSuccess).toBe(0);
    const sent = await processNextEsimQrNotifyOutbox();
    expect(sent.outcome).toBe("processed");
    expect(state.solapiSuccess).toBe(1);
    expect(state.solapiAttempts).toBe(2);
  });

  it("dry-run does not call Solapi and leaves the row pending", async () => {
    await payOnce();
    await processNextOrderPaidOutbox();
    process.env.BONGSIM_ESIM_QR_NOTIFY_DRY_RUN = "1";
    const sent = await processNextEsimQrNotifyOutbox();
    expect(sent.outcome).toBe("dry_run");
    expect(state.solapiAttempts).toBe(0);
    const row = notifyRows()[0];
    expect(row?.processed_at).toBeNull();
    expect(row?.locked_at).toBeNull();
  });

  it("holds an unstamped backlog row so it is not sent or processed", async () => {
    await payOnce();
    await processNextOrderPaidOutbox();
    const row = notifyRows()[0]!;
    delete row.payload._enqueued_at;
    row.processed_at = null;
    process.env.BONGSIM_ESIM_QR_NOTIFY_HOLD_AFTER_HOURS = "48";
    const sent = await processNextEsimQrNotifyOutbox();
    expect(sent.outcome).toBe("empty");
    expect(state.solapiAttempts).toBe(0);
    expect(row.processed_at).toBeNull();
    const hold = row.payload._outbox_hold as { active?: boolean } | undefined;
    expect(hold?.active).toBe(true);
    expect(JSON.stringify(row.payload._outbox_defer ?? {})).not.toContain('"terminal":true');
  });
});
