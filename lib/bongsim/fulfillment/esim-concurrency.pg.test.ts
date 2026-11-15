/**
 * eSIM 동시성 회귀 — 실제 결제·유심사·솔라피 호출 없음.
 * ESIM_CONCURRENCY_PG=1 이고 DATABASE_URL 이 로컬/CI Postgres 를 가리킬 때만 실행.
 * 기본 `npm test`(더미 URL, PG 없음)에서는 skip 한다.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Pool, type PoolClient } from "pg";

const enabled = process.env.ESIM_CONCURRENCY_PG === "1";
const databaseUrl = (process.env.DATABASE_URL ?? "").trim();

const testPool: Pool | null =
  enabled && databaseUrl
    ? new Pool({ connectionString: databaseUrl, ssl: false, max: 16 })
    : null;

vi.mock("@/lib/bongsim/db/pool", () => ({
  getPgPool: () => {
    if (!testPool) throw new Error("test pool not initialised");
    return testPool;
  },
  getBongsimOutboxPool: () => {
    if (!testPool) throw new Error("test pool not initialised");
    return testPool;
  },
  getBongsimFulfillOutboxPool: () => {
    if (!testPool) throw new Error("test pool not initialised");
    return testPool;
  },
  healBongsimPgPoolForCatalog: async () => {},
}));

vi.mock("@/lib/instrumentation-process-role", () => ({
  shouldDrainOrderPaidInThisProcess: () => false,
  shouldRunFulfillmentCrons: () => false,
  resolveInstrumentationProcessRole: () => "web",
  resolveBongsimFulfillmentOwner: () => "web",
}));

vi.mock("@/lib/bongsim/fulfillment/process-order-paid-outbox", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bongsim/fulfillment/process-order-paid-outbox")>();
  return { ...actual, ensureOrderPaidOutboxDrainAfterEnqueue: () => {} };
});

vi.mock("@/lib/bongsim/esim-live-fulfillment", () => ({
  isEsimLiveIssuanceAndSmsAllowed: () => true,
}));

type UsimsaMode = "ok" | "delay" | "timeout-success" | "fail";
const usimsa = {
  posts: 0,
  queries: 0,
  mode: "ok" as UsimsaMode,
  delayMs: 250,
  entered: 0,
  gate: Promise.resolve(),
  releaseGate: () => {},
  byOrder: new Map<string, Array<{ topup_id: string; option_api_id: string; fulfillment_mode: string }>>(),
};

function resetUsimsa(mode: UsimsaMode = "ok", delayMs = 250) {
  usimsa.posts = 0;
  usimsa.queries = 0;
  usimsa.mode = mode;
  usimsa.delayMs = delayMs;
  usimsa.entered = 0;
  usimsa.byOrder.clear();
  usimsa.gate = new Promise<void>((resolve) => {
    usimsa.releaseGate = resolve;
  });
}

vi.mock("@/lib/bongsim/supplier/supplier-client-registry", () => ({
  isAsyncSupplier: (id: string) => id === "usimsa",
  getDefaultSupplierClient: () => ({
    id: "usimsa",
    async submitPaidOrder(input: { order_number: string }) {
      usimsa.posts += 1;
      usimsa.entered += 1;
      const topups = [
        {
          topup_id: `top-${input.order_number}`,
          option_api_id: "opt-jp-3d",
          fulfillment_mode: "esim",
        },
      ];
      // timeout-success: 공급사는 주문을 받았지만 HTTP 가 타임아웃된 상황
      usimsa.byOrder.set(input.order_number, topups);
      if (usimsa.mode === "delay") {
        // 두 워커가 같이 들어오면 바로 풀고, 한 명만 들어오면 delayMs 후 진행
        if (usimsa.entered >= 2) usimsa.releaseGate();
        await Promise.race([usimsa.gate, new Promise((r) => setTimeout(r, usimsa.delayMs))]);
      } else if (usimsa.mode === "timeout-success") {
        await new Promise((r) => setTimeout(r, usimsa.delayMs));
      }
      if (usimsa.mode === "timeout-success" || usimsa.mode === "fail") {
        const err = new Error("USIMSA API timeout after 15s");
        (err as { code?: string }).code = "ETIMEDOUT";
        throw err;
      }
      return { submission_id: `usimsa_${input.order_number}`, topups };
    },
  }),
}));

vi.mock("@/lib/bongsim/supplier/usimsa/order-api", () => ({
  queryUsimsaOrder: async (orderId: string) => {
    usimsa.queries += 1;
    const topups = usimsa.byOrder.get(orderId);
    if (!topups) {
      return { code: "4040", message: "not found", products: [] };
    }
    return {
      code: "0000",
      message: "",
      products: topups.map((t) => ({
        topupId: t.topup_id,
        optionId: t.option_api_id,
        status: "issued",
      })),
    };
  },
  submitUsimsaOrder: async () => {
    throw new Error("live USIMSA blocked in concurrency test");
  },
}));

const notify = { sends: 0, delayMs: 0, byOrder: [] as string[] };
function resetNotify(delayMs = 0) {
  notify.sends = 0;
  notify.delayMs = delayMs;
  notify.byOrder = [];
}

vi.mock("@/lib/bongsim/fulfillment/esim-delivery", () => ({
  maybeDeliverEsimAfterFulfillment: async () => {},
  sendQueuedEsimQrCustomerNotify: async (row: { order_id: string }) => {
    if (notify.delayMs) await new Promise((r) => setTimeout(r, notify.delayMs));
    notify.sends += 1;
    notify.byOrder.push(row.order_id);
  },
}));

const describeIf = enabled && databaseUrl && testPool ? describe : describe.skip;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function applyOfficialBongsimMigrations(pool: Pool) {
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
        CREATE ROLE supabase_admin;
      END IF;
    END
    $$;
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  `);
  const dir = join(process.cwd(), "db/bongsim-migrations");
  const files = readdirSync(dir)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    // image_assets 제약은 테스트 하네스에 해당 테이블이 없어 건너뛴다.
    .filter((f) => !f.includes("image_assets"))
    .sort();
  for (const f of files) {
    const sql = readFileSync(join(dir, f), "utf8");
    try {
      await pool.query(sql);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`migration ${f} failed: ${msg}`);
    }
  }
}

async function truncateBongsim(pool: Pool) {
  const sql = `
    TRUNCATE TABLE
      public.bongsim_supplier_api_log,
      public.bongsim_fulfillment_event,
      public.bongsim_fulfillment_topup,
      public.bongsim_fulfillment_job,
      public.bongsim_outbox,
      public.bongsim_payment_provider_event,
      public.bongsim_payment_attempt,
      public.bongsim_order_line,
      public.bongsim_order
    RESTART IDENTITY CASCADE`;
  let last: unknown;
  for (let i = 0; i < 8; i += 1) {
    try {
      await pool.query("SET lock_timeout = '2s'");
      await pool.query(sql);
      return;
    } catch (err) {
      last = err;
      const code = typeof err === "object" && err && "code" in err ? String((err as { code?: string }).code) : "";
      if (code !== "40P01" && code !== "55P03") throw err;
      await new Promise((r) => setTimeout(r, 80 * (i + 1)));
    }
  }
  throw last;
}

async function insertAwaitingOrder(
  client: Pool | PoolClient,
  opts: {
    orderNumber: string;
    amount: number;
    sessionId: string;
    mid?: string;
  },
) {
  const order = await client.query<{ order_id: string }>(
    `INSERT INTO public.bongsim_order (
       order_number, status, checkout_channel, currency, buyer_locale,
       idempotency_key, subtotal_krw, grand_total_krw, buyer_email, buyer_tel
     ) VALUES (
       $1, 'awaiting_payment', 'web', 'KRW', 'ko',
       $2, $3, $3, $4, '01000000000'
     ) RETURNING order_id`,
    [opts.orderNumber, `idem-${opts.orderNumber}`, opts.amount, `${opts.orderNumber}@example.test`],
  );
  const orderId = order.rows[0].order_id;
  await client.query(
    `INSERT INTO public.bongsim_order_line (
       order_id, option_api_id, quantity, charged_unit_price_krw, line_total_krw,
       charged_basis_key, snapshot
     ) VALUES ($1, 'opt-jp-3d', 1, $2, $2, 'unit', '{}'::jsonb)`,
    [orderId, opts.amount],
  );
  const attempt = await client.query<{ payment_attempt_id: string }>(
    `INSERT INTO public.bongsim_payment_attempt (
       order_id, provider, provider_session_id, status, amount_krw, currency, idempotency_key
     ) VALUES ($1, 'welcomepay', $2, 'awaiting_payment', $3, 'KRW', $4)
     RETURNING payment_attempt_id`,
    [orderId, opts.sessionId, opts.amount, `pay-${opts.sessionId}`],
  );
  return { orderId, attemptId: attempt.rows[0].payment_attempt_id };
}

async function countsForOrder(pool: Pool, orderId: string) {
  const ev = await pool.query(
    `SELECT count(*)::int AS n FROM public.bongsim_payment_provider_event
     WHERE order_id = $1`,
    [orderId],
  );
  const paid = await pool.query(
    `SELECT status, paid_amount_krw, grand_total_krw FROM public.bongsim_order WHERE order_id = $1`,
    [orderId],
  );
  const outbox = await pool.query(
    `SELECT count(*)::int AS n FROM public.bongsim_outbox
     WHERE topic = 'OrderPaid' AND (payload->>'order_id') = $1`,
    [orderId],
  );
  const jobs = await pool.query(
    `SELECT count(*)::int AS n, coalesce(array_agg(status), '{}') AS statuses
     FROM public.bongsim_fulfillment_job WHERE order_id = $1`,
    [orderId],
  );
  const topups = await pool.query(
    `SELECT count(*)::int AS n FROM public.bongsim_fulfillment_topup WHERE order_id = $1`,
    [orderId],
  );
  const notifyRows = await pool.query(
    `SELECT count(*)::int AS n,
            count(*) FILTER (WHERE processed_at IS NOT NULL)::int AS processed
     FROM public.bongsim_outbox
     WHERE topic = 'EsimQrNotify' AND (payload->>'order_id') = $1`,
    [orderId],
  );
  return {
    captureEvents: ev.rows[0].n as number,
    status: paid.rows[0]?.status as string,
    paidAmount: Number(paid.rows[0]?.paid_amount_krw ?? 0),
    grandTotal: Number(paid.rows[0]?.grand_total_krw ?? 0),
    orderPaid: outbox.rows[0].n as number,
    jobs: jobs.rows[0].n as number,
    jobStatuses: jobs.rows[0].statuses as string[],
    topups: topups.rows[0].n as number,
    notifyRows: notifyRows.rows[0].n as number,
    notifyProcessed: notifyRows.rows[0].processed as number,
  };
}


function captureArgs(attemptId: string, eventId: string, amount: number, tid: string, extra: Record<string, unknown> = {}) {
  return {
    providerEventId: eventId,
    paymentAttemptId: attemptId,
    outcome: "captured" as const,
    amountKrw: amount,
    paymentReference: tid,
    rawPayload: { tid, ...extra },
  };
}

describeIf("eSIM concurrency (pg harness, mocks only)", () => {
  beforeAll(async () => {
    if (!testPool) throw new Error("test pool missing");
    await applyOfficialBongsimMigrations(testPool);
  }, 60_000);

  afterAll(async () => {
    await testPool?.end();
  });

  beforeEach(async () => {
    if (!testPool) throw new Error("test pool missing");
    await truncateBongsim(testPool);
    resetUsimsa("ok");
    resetNotify(0);
  });

  it("(index) same provider+provider_session_id cannot be inserted twice", async () => {
    const a = await insertAwaitingOrder(testPool!, {
      orderNumber: "BS-TEST-SESS-A",
      amount: 6660,
      sessionId: "mid_test_same_session",
    });
    const b = await insertAwaitingOrder(testPool!, {
      orderNumber: "BS-TEST-SESS-B",
      amount: 8910,
      sessionId: "mid_test_other_session",
    });
    let code: string | undefined;
    try {
      await testPool!.query(
        `INSERT INTO public.bongsim_payment_attempt (
           order_id, provider, provider_session_id, status, amount_krw, currency, idempotency_key
         ) VALUES ($1, 'welcomepay', $2, 'awaiting_payment', 6660, 'KRW', 'pay-dup-same-session')`,
        [b.orderId, "mid_test_same_session"],
      );
    } catch (err) {
      code = typeof err === "object" && err && "code" in err ? String((err as { code?: string }).code) : undefined;
    }
    expect(code, "unique index on (provider, provider_session_id) must reject the second row").toBe("23505");
    const n = await testPool!.query(
      `SELECT count(*)::int AS n FROM public.bongsim_payment_attempt WHERE provider_session_id = 'mid_test_same_session'`,
    );
    expect(n.rows[0].n).toBe(1);
    expect(a.orderId).not.toBe(b.orderId);
  });

  it("(a) same WelcomePay callback delivered N times concurrently processes once", async () => {
    const { processWelcomepayPaymentOutcome } = await import(
      "@/lib/bongsim/data/process-welcomepay-payment-outcome"
    );
    const seeded = await insertAwaitingOrder(testPool!, {
      orderNumber: "BS-TEST-CB-N",
      amount: 6660,
      sessionId: "mid_test_cb_n",
    });
    const tid = "TID-CB-N";
    const args = captureArgs(seeded.attemptId, `welcomepay_auth_${tid}`, 6660, tid, { reason: "pc-return" });
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => processWelcomepayPaymentOutcome(args)),
    );
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled.length).toBe(8);
    const c = await countsForOrder(testPool!, seeded.orderId);
    expect(c.status).toBe("paid");
    expect(c.paidAmount).toBe(6660);
    expect(c.grandTotal).toBe(6660);
    expect(c.captureEvents).toBe(1);
    expect(c.orderPaid).toBe(1);
  });

  it("(a) PC return and noti for the same order at the same time still approve once", async () => {
    const { processWelcomepayPaymentOutcome } = await import(
      "@/lib/bongsim/data/process-welcomepay-payment-outcome"
    );
    const seeded = await insertAwaitingOrder(testPool!, {
      orderNumber: "BS-TEST-CB-BOTH",
      amount: 6660,
      sessionId: "mid_test_cb_both",
    });
    const tid = "TID-CB-BOTH";
    const results = await Promise.allSettled([
      processWelcomepayPaymentOutcome(
        captureArgs(seeded.attemptId, `welcomepay_auth_${tid}`, 6660, tid, { reason: "pc-return" }),
      ),
      processWelcomepayPaymentOutcome(
        captureArgs(seeded.attemptId, `welcomepay_mobile_${tid}`, 6660, tid, { reason: "mobile-next" }),
      ),
      processWelcomepayPaymentOutcome(
        captureArgs(seeded.attemptId, `welcomepay_vbank_noti_${tid}_20261114185400`, 6660, tid, { reason: "vbank-noti" }),
      ),
    ]);
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(3);
    const c = await countsForOrder(testPool!, seeded.orderId);
    expect(c.status).toBe("paid");
    expect(c.paidAmount).toBe(6660);
    expect(c.orderPaid).toBe(1);
    expect(c.captureEvents).toBe(3);
  });

  it("(b) multiple distinct orders processed concurrently do not mix", async () => {
    const { processWelcomepayPaymentOutcome } = await import(
      "@/lib/bongsim/data/process-welcomepay-payment-outcome"
    );
    const { processNextOrderPaidOutbox } = await import(
      "@/lib/bongsim/fulfillment/process-order-paid-outbox"
    );
    resetUsimsa("ok");
    const specs = [
      { orderNumber: "BS-TEST-M1", amount: 6660, sessionId: "mid_m1", tid: "TID-M1" },
      { orderNumber: "BS-TEST-M2", amount: 8910, sessionId: "mid_m2", tid: "TID-M2" },
      { orderNumber: "BS-TEST-M3", amount: 12900, sessionId: "mid_m3", tid: "TID-M3" },
    ];
    const seeded = [];
    for (const s of specs) {
      seeded.push(await insertAwaitingOrder(testPool!, s));
    }
    await Promise.all(
      specs.map((s, i) =>
        processWelcomepayPaymentOutcome(
          captureArgs(seeded[i].attemptId, `welcomepay_auth_${s.tid}`, s.amount, s.tid, { reason: "pc-return" }),
        ),
      ),
    );
    await Promise.all([
      processNextOrderPaidOutbox(),
      processNextOrderPaidOutbox(),
      processNextOrderPaidOutbox(),
      processNextOrderPaidOutbox(),
    ]);
    const postsByOrder = [...usimsa.byOrder.keys()].sort();
    expect(postsByOrder).toEqual(["BS-TEST-M1", "BS-TEST-M2", "BS-TEST-M3"]);
    expect(usimsa.posts).toBe(3);
    for (let i = 0; i < specs.length; i++) {
      const c = await countsForOrder(testPool!, seeded[i].orderId);
      expect(c.status, specs[i].orderNumber).toBe("paid");
      expect(c.paidAmount, specs[i].orderNumber).toBe(specs[i].amount);
      expect(c.grandTotal, specs[i].orderNumber).toBe(specs[i].amount);
      expect(c.orderPaid, specs[i].orderNumber).toBe(1);
      expect(c.jobs, specs[i].orderNumber).toBe(1);
      expect(c.topups, specs[i].orderNumber).toBe(1);
      const top = await testPool!.query(
        `SELECT t.topup_id, j.supplier_order_ref
         FROM public.bongsim_fulfillment_topup t
         JOIN public.bongsim_fulfillment_job j ON j.job_id = t.job_id
         WHERE j.order_id = $1`,
        [seeded[i].orderId],
      );
      expect(top.rows[0].topup_id).toBe(`top-${specs[i].orderNumber}`);
      expect(top.rows[0].supplier_order_ref).toBe(specs[i].orderNumber);
    }
  });

  it("(c) two workers racing the same OrderPaid/job row post to USIMSA once", async () => {
    const { processWelcomepayPaymentOutcome } = await import(
      "@/lib/bongsim/data/process-welcomepay-payment-outcome"
    );
    const { processNextOrderPaidOutbox } = await import(
      "@/lib/bongsim/fulfillment/process-order-paid-outbox"
    );
    resetUsimsa("delay", 400);
    const seeded = await insertAwaitingOrder(testPool!, {
      orderNumber: "BS-TEST-RACE-JOB",
      amount: 6660,
      sessionId: "mid_race_job",
    });
    await processWelcomepayPaymentOutcome(
      captureArgs(seeded.attemptId, "welcomepay_auth_TID-RACE-JOB", 6660, "TID-RACE-JOB"),
    );
    const first = processNextOrderPaidOutbox();
    await sleep(80);
    // 리스가 아직 남은 상태에서 두 번째 워커가 같은 행을 다시 집는 경쟁
    await testPool!.query(
      `UPDATE public.bongsim_outbox
         SET available_at = now() - interval '1 second',
             locked_at = now() - interval '11 minutes'
       WHERE topic = 'OrderPaid' AND (payload->>'order_id') = $1`,
      [seeded.orderId],
    );
    const second = processNextOrderPaidOutbox();
    const results = await Promise.allSettled([first, second]);
    expect(results.filter((r) => r.status === "fulfilled").length).toBeGreaterThanOrEqual(1);
    expect(usimsa.posts).toBe(1);
    const c = await countsForOrder(testPool!, seeded.orderId);
    expect(c.jobs).toBe(1);
    expect(c.topups).toBe(1);
    expect(c.orderPaid).toBe(1);
    expect(c.paidAmount).toBe(6660);
  });

  it("(c) two workers racing the same EsimQrNotify row send once, even if stale-unlock runs mid-send", async () => {
    const { enqueueEsimQrNotify, processNextEsimQrNotifyOutbox } = await import(
      "@/lib/bongsim/fulfillment/esim-qr-notify-outbox"
    );
    const cron = await import("@/lib/instrumentation-bongsim-order-paid-outbox-cron");
    if (typeof cron.unlockStaleFulfillOutboxes !== "function") {
      throw new Error("unlockStaleFulfillOutboxes must be exported for this test");
    }
    resetNotify(400);
    const seeded = await insertAwaitingOrder(testPool!, {
      orderNumber: "BS-TEST-RACE-SMS",
      amount: 6660,
      sessionId: "mid_race_sms",
    });
    await testPool!.query(
      `UPDATE public.bongsim_order SET status = 'paid', paid_amount_krw = 6660, paid_at = now() WHERE order_id = $1`,
      [seeded.orderId],
    );
    await enqueueEsimQrNotify({
      order_id: seeded.orderId,
      order_number: "BS-TEST-RACE-SMS",
      delivery_email: "BS-TEST-RACE-SMS@example.test",
      delivery_phone: "01000000000",
      qr_code_url: "https://example.test/qr",
      download_link: "https://example.test/lpa",
    });
    const first = processNextEsimQrNotifyOutbox();
    await sleep(80);
    await testPool!.query(
      `UPDATE public.bongsim_outbox
         SET locked_at = now() - interval '11 minutes'
       WHERE topic = 'EsimQrNotify' AND (payload->>'order_id') = $1`,
      [seeded.orderId],
    );
    await cron.unlockStaleFulfillOutboxes();
    const second = processNextEsimQrNotifyOutbox();
    await Promise.allSettled([first, second]);
    expect(notify.sends).toBe(1);
    const c = await countsForOrder(testPool!, seeded.orderId);
    expect(c.notifyRows).toBe(1);
    expect(c.notifyProcessed).toBe(1);
  });

  it("(d) USIMSA delay beyond the outbox lease does not cause a second POST", async () => {
    const { processWelcomepayPaymentOutcome } = await import(
      "@/lib/bongsim/data/process-welcomepay-payment-outcome"
    );
    const { processNextOrderPaidOutbox } = await import(
      "@/lib/bongsim/fulfillment/process-order-paid-outbox"
    );
    resetUsimsa("delay", 500);
    const seeded = await insertAwaitingOrder(testPool!, {
      orderNumber: "BS-TEST-LEASE",
      amount: 6660,
      sessionId: "mid_lease",
    });
    await processWelcomepayPaymentOutcome(
      captureArgs(seeded.attemptId, "welcomepay_auth_TID-LEASE", 6660, "TID-LEASE"),
    );
    const first = processNextOrderPaidOutbox();
    await sleep(80);
    // 리스 만료를 시뮬레이션: available_at 을 과거로 되돌리고 두 번째 워커를 투입
    await testPool!.query(
      `UPDATE public.bongsim_outbox
         SET available_at = now() - interval '1 second',
             locked_at = now() - interval '11 minutes'
       WHERE topic = 'OrderPaid' AND (payload->>'order_id') = $1`,
      [seeded.orderId],
    );
    const second = processNextOrderPaidOutbox();
    await Promise.allSettled([first, second]);
    expect(usimsa.posts).toBe(1);
    const c = await countsForOrder(testPool!, seeded.orderId);
    expect(c.jobs).toBe(1);
    expect(c.topups).toBe(1);
  });

  it("(d) USIMSA timeout after accept then recovery posts once and settles the job", async () => {
    const { processWelcomepayPaymentOutcome } = await import(
      "@/lib/bongsim/data/process-welcomepay-payment-outcome"
    );
    const { processNextOrderPaidOutbox } = await import(
      "@/lib/bongsim/fulfillment/process-order-paid-outbox"
    );
    const { advanceFulfillmentForPaidOrderReleasingDuringSubmit } = await import(
      "@/lib/bongsim/fulfillment/process-fulfillment-job"
    );
    resetUsimsa("timeout-success", 80);
    const seeded = await insertAwaitingOrder(testPool!, {
      orderNumber: "BS-TEST-TIMEOUT",
      amount: 6660,
      sessionId: "mid_timeout",
    });
    await processWelcomepayPaymentOutcome(
      captureArgs(seeded.attemptId, "welcomepay_auth_TID-TIMEOUT", 6660, "TID-TIMEOUT"),
    );
    const first = await Promise.allSettled([processNextOrderPaidOutbox()]);
    expect(first[0].status).toBe("fulfilled"); // outbox 함수는 throw 를 삼키거나 deferred
    expect(usimsa.posts).toBe(1);
    // 복구: GET 으로 이미 접수된 주문을 찾아 topup 을 남기고 재POST 하지 않는다
    resetUsimsa("ok", 0);
    // byOrder 가 reset 되며 비므로, 첫 POST 가 남긴 주문을 다시 넣는다
    usimsa.byOrder.set("BS-TEST-TIMEOUT", [
      { topup_id: "top-BS-TEST-TIMEOUT", option_api_id: "opt-jp-3d", fulfillment_mode: "esim" },
    ]);
    usimsa.posts = 1; // 이전 POST 누적 유지
    await advanceFulfillmentForPaidOrderReleasingDuringSubmit(seeded.orderId);
    expect(usimsa.posts).toBe(1);
    expect(usimsa.queries).toBeGreaterThanOrEqual(1);
    const c = await countsForOrder(testPool!, seeded.orderId);
    expect(c.jobs).toBe(1);
    expect(c.topups).toBe(1);
    expect(c.jobStatuses.every((s) => s === "submitted" || s === "delivered")).toBe(true);
    expect(c.paidAmount).toBe(6660);
  });

  it("(d) hard USIMSA failure keeps a recoverable job (not a terminal failed with no retry)", async () => {
    const { processWelcomepayPaymentOutcome } = await import(
      "@/lib/bongsim/data/process-welcomepay-payment-outcome"
    );
    const { processNextOrderPaidOutbox } = await import(
      "@/lib/bongsim/fulfillment/process-order-paid-outbox"
    );
    resetUsimsa("fail", 0);
    const seeded = await insertAwaitingOrder(testPool!, {
      orderNumber: "BS-TEST-FAIL",
      amount: 6660,
      sessionId: "mid_fail",
    });
    await processWelcomepayPaymentOutcome(
      captureArgs(seeded.attemptId, "welcomepay_auth_TID-FAIL", 6660, "TID-FAIL"),
    );
    await processNextOrderPaidOutbox();
    const job = await testPool!.query(
      `SELECT status, attempt_count, last_error IS NOT NULL AS has_error
       FROM public.bongsim_fulfillment_job WHERE order_id = $1`,
      [seeded.orderId],
    );
    expect(job.rows.length).toBe(1);
    expect(job.rows[0].status).not.toBe("failed");
    expect(job.rows[0].status).toBe("in_progress");
    expect(job.rows[0].has_error).toBe(true);
    const outbox = await testPool!.query(
      `SELECT processed_at IS NOT NULL AS processed
       FROM public.bongsim_outbox
       WHERE topic = 'OrderPaid' AND (payload->>'order_id') = $1`,
      [seeded.orderId],
    );
    expect(outbox.rows[0].processed).toBe(false);
  });
});
