import type { PoolClient } from "pg";
import type { BongsimPaymentReturnUrlsV1 } from "@/lib/bongsim/contracts/payment-integration.v1";
import type {
  BongsimPaymentSessionRequestV1,
  BongsimPaymentSessionResponseV1,
} from "@/lib/bongsim/contracts/payment-session.v1";
import type { PaymentAttemptStatus } from "@/lib/bongsim/contracts/public-enums";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { mergeOrderReadKeyIntoReturnUrls } from "@/lib/bongsim/payments/merge-order-read-key-into-return-urls";
import { getPaymentProviderAdapter } from "@/lib/bongsim/payments/payment-provider-registry";
import { isMockPaymentCaptureAllowed } from "@/lib/bongsim/runtime/mock-payment-allowance";
import { isNodeProduction } from "@/lib/bongsim/runtime/node-env";

export type CreatePaymentSessionResult =
  | { ok: true; body: BongsimPaymentSessionResponseV1 }
  | {
      ok: false;
      reason:
        | "db_unconfigured"
        | "db_error"
        | "validation"
        | "order_not_found"
        | "order_not_payable"
        | "payment_already_captured"
        | "provider_not_supported"
        | "idempotency_incompatible";
      details?: Record<string, string>;
    };

type OrderRow = {
  order_id: string;
  order_number: string;
  status: string;
  buyer_email: string;
  grand_total_krw: string;
  currency: string;
  created_at: Date;
};

type AttemptRow = {
  payment_attempt_id: string;
  order_id: string;
  idempotency_key: string;
  status: string;
  provider: string;
  provider_session_id: string | null;
  amount_krw: string;
  currency: string;
  return_urls: unknown;
  created_at: Date;
  updated_at: Date;
};

const REUSABLE: Set<PaymentAttemptStatus> = new Set(["created", "redirected", "authorized"]);

function toInt(n: string | number): number {
  return typeof n === "string" ? Number.parseInt(n, 10) : Math.trunc(Number(n));
}

function parseStoredReturnUrls(raw: unknown): BongsimPaymentReturnUrlsV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const s = typeof o.success_url === "string" ? o.success_url.trim() : "";
  const f = typeof o.fail_url === "string" ? o.fail_url.trim() : "";
  const c = typeof o.cancel_url === "string" ? o.cancel_url.trim() : "";
  if (!s || !f || !c) return null;
  return { success_url: s, fail_url: f, cancel_url: c };
}

function isSafeReturnUrl(u: string): boolean {
  if (u.startsWith("/") && !u.startsWith("//")) return u.length <= 2048;
  try {
    const parsed = new URL(u);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function validateBody(body: unknown): { ok: true; req: BongsimPaymentSessionRequestV1 } | { ok: false; details: Record<string, string> } {
  if (!body || typeof body !== "object") return { ok: false, details: { body: "invalid_json_shape" } };
  const o = body as Record<string, unknown>;
  const order_id = typeof o.order_id === "string" ? o.order_id.trim() : "";
  const key = typeof o.idempotency_key === "string" ? o.idempotency_key.trim() : "";
  const details: Record<string, string> = {};
  if (!order_id) details.order_id = "required";
  if (!key) details.idempotency_key = "required";
  const ru = o.return_urls;
  if (!ru || typeof ru !== "object") {
    details.return_urls = "required";
  } else {
    const urls = ru as Record<string, unknown>;
    const success_url = typeof urls.success_url === "string" ? urls.success_url.trim() : "";
    const fail_url = typeof urls.fail_url === "string" ? urls.fail_url.trim() : "";
    const cancel_url = typeof urls.cancel_url === "string" ? urls.cancel_url.trim() : "";
    if (!success_url || !fail_url || !cancel_url) details.return_urls = "all_urls_required";
    else if (!isSafeReturnUrl(success_url) || !isSafeReturnUrl(fail_url) || !isSafeReturnUrl(cancel_url)) {
      details.return_urls = "invalid_url";
    }
  }
  if (Object.keys(details).length) return { ok: false, details };

  const provider = typeof o.provider === "string" && o.provider.trim() ? o.provider.trim() : "bongsim_mock";

  const return_urls: BongsimPaymentReturnUrlsV1 = {
    success_url: String((o.return_urls as Record<string, unknown>).success_url).trim(),
    fail_url: String((o.return_urls as Record<string, unknown>).fail_url).trim(),
    cancel_url: String((o.return_urls as Record<string, unknown>).cancel_url).trim(),
  };

  return {
    ok: true,
    req: {
      schema: "bongsim.payment_session.request.v1",
      order_id,
      idempotency_key: key,
      provider,
      return_urls,
    },
  };
}

function attemptToResponse(
  order: OrderRow,
  row: AttemptRow,
  client: BongsimPaymentSessionResponseV1["client"],
  reused: boolean,
): BongsimPaymentSessionResponseV1 {
  return {
    schema: "bongsim.payment_session.response.v1",
    payment_attempt_id: row.payment_attempt_id,
    order_id: order.order_id,
    order_number: order.order_number,
    provider: row.provider,
    amount_krw: toInt(row.amount_krw),
    currency: "KRW",
    client,
    created_at: row.created_at.toISOString(),
    reused,
  };
}

async function hasCapturedAttempt(client: PoolClient, orderId: string): Promise<boolean> {
  const r = await client.query<{ ok: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM bongsim_payment_attempt
       WHERE order_id = $1 AND status = 'captured'
     ) AS ok`,
    [orderId],
  );
  return Boolean(r.rows[0]?.ok);
}

async function loadOrder(client: PoolClient, orderId: string): Promise<OrderRow | null> {
  const r = await client.query<OrderRow>(`SELECT order_id, order_number, status, buyer_email, grand_total_krw, currency, created_at FROM bongsim_order WHERE order_id = $1 LIMIT 1`, [orderId]);
  return r.rows[0] ?? null;
}

async function loadAttempt(client: PoolClient, orderId: string, idempotencyKey: string): Promise<AttemptRow | null> {
  const r = await client.query<AttemptRow>(
    `SELECT * FROM bongsim_payment_attempt WHERE order_id = $1 AND idempotency_key = $2 LIMIT 1`,
    [orderId, idempotencyKey],
  );
  return r.rows[0] ?? null;
}

export async function createPaymentSessionFromRequest(body: unknown): Promise<CreatePaymentSessionResult> {
  const v = validateBody(body);
  if (!v.ok) return { ok: false, reason: "validation", details: v.details };

  const readKeyForUrls = process.env.BONGSIM_ORDER_READ_KEY?.trim();
  const req = {
    ...v.req,
    return_urls: mergeOrderReadKeyIntoReturnUrls(v.req.return_urls, readKeyForUrls),
  };
  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured" };

  const effProvider = req.provider ?? "bongsim_mock";
  if (isNodeProduction() && !isMockPaymentCaptureAllowed() && effProvider === "bongsim_mock") {
    return {
      ok: false,
      reason: "validation",
      details: { provider: "mock_provider_blocked_in_production_set_BONGSIM_ALLOW_MOCK_CAPTURE" },
    };
  }

  const adapter = getPaymentProviderAdapter(effProvider);
  if (!adapter) return { ok: false, reason: "provider_not_supported", details: { provider: effProvider } };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const order = await loadOrder(client, req.order_id);
    if (!order) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "order_not_found" };
    }
    if (!order.buyer_email || !order.buyer_email.trim()) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "validation", details: { buyer_email: "missing_on_order" } };
    }
    if (order.status !== "awaiting_payment") {
      await client.query("ROLLBACK");
      return { ok: false, reason: "order_not_payable", details: { status: order.status } };
    }
    if (await hasCapturedAttempt(client, order.order_id)) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "payment_already_captured" };
    }

    await client.query(`SELECT order_id FROM bongsim_order WHERE order_id = $1 FOR UPDATE`, [order.order_id]);

    const existing = await client.query<AttemptRow>(
      `SELECT * FROM bongsim_payment_attempt WHERE order_id = $1 AND idempotency_key = $2 FOR UPDATE`,
      [order.order_id, req.idempotency_key],
    );
    const ex = existing.rows[0];
    if (ex) {
      const st = ex.status as PaymentAttemptStatus;
      const amountOk = toInt(ex.amount_krw) === toInt(order.grand_total_krw);
      const providerOk = ex.provider === (req.provider ?? "bongsim_mock");
      if (REUSABLE.has(st) && amountOk && providerOk) {
        const adapterReuse = getPaymentProviderAdapter(ex.provider);
        if (!adapterReuse) {
          await client.query("ROLLBACK");
          return { ok: false, reason: "provider_not_supported", details: { provider: ex.provider } };
        }
        const returnUrlsReuse = mergeOrderReadKeyIntoReturnUrls(
          parseStoredReturnUrls(ex.return_urls) ?? req.return_urls,
          readKeyForUrls,
        );
        const provReuse = await adapterReuse.createSession({
          provider: ex.provider,
          payment_attempt_id: ex.payment_attempt_id,
          order_id: order.order_id,
          order_number: order.order_number,
          buyer_email: order.buyer_email,
          amount_krw: toInt(order.grand_total_krw),
          currency: "KRW",
          return_urls: returnUrlsReuse,
        });
        await client.query("COMMIT");
        return { ok: true, body: attemptToResponse(order, ex, provReuse.client, true) };
      }
      await client.query("ROLLBACK");
      return { ok: false, reason: "idempotency_incompatible", details: { status: ex.status } };
    }

    const amount = toInt(order.grand_total_krw);
    const insAttempt = await client.query<{ payment_attempt_id: string }>(
      `INSERT INTO bongsim_payment_attempt (
        order_id, idempotency_key, status, provider, provider_session_id,
        amount_krw, currency, return_urls, last_error
      ) VALUES ($1, $2, 'created', $3, NULL, $4, 'KRW', $5::jsonb, NULL)
      RETURNING payment_attempt_id`,
      [order.order_id, req.idempotency_key, req.provider ?? "bongsim_mock", amount, JSON.stringify(req.return_urls)],
    );
    const payment_attempt_id = insAttempt.rows[0]?.payment_attempt_id;
    if (!payment_attempt_id) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "db_error" };
    }

    const prov = await adapter.createSession({
      provider: adapter.id,
      payment_attempt_id,
      order_id: order.order_id,
      order_number: order.order_number,
      buyer_email: order.buyer_email,
      amount_krw: amount,
      currency: "KRW",
      return_urls: req.return_urls,
    });

    await client.query(
      `UPDATE bongsim_payment_attempt
       SET provider_session_id = $2, status = 'redirected', updated_at = now()
       WHERE payment_attempt_id = $1`,
      [payment_attempt_id, prov.provider_session_id],
    );

    const row = await loadAttempt(client, order.order_id, req.idempotency_key);
    if (!row) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "db_error" };
    }

    await client.query("COMMIT");

    const body = attemptToResponse(order, row, prov.client, false);
    return { ok: true, body };
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    const err = e as { code?: string };
    if (err.code === "23505") {
      const c2 = await pool.connect();
      try {
        const order = await loadOrder(c2, req.order_id);
        if (!order) return { ok: false, reason: "db_error" };
        const row = await loadAttempt(c2, order.order_id, req.idempotency_key);
        if (!row) return { ok: false, reason: "db_error" };
        const st = row.status as PaymentAttemptStatus;
        const amountOk = toInt(row.amount_krw) === toInt(order.grand_total_krw);
        const providerOk = row.provider === (req.provider ?? "bongsim_mock");
        if (REUSABLE.has(st) && amountOk && providerOk) {
          const adapterRace = getPaymentProviderAdapter(row.provider);
          if (!adapterRace) return { ok: false, reason: "provider_not_supported", details: { provider: row.provider } };
          const returnUrlsRace = mergeOrderReadKeyIntoReturnUrls(
            parseStoredReturnUrls(row.return_urls) ?? req.return_urls,
            readKeyForUrls,
          );
          const provRace = await adapterRace.createSession({
            provider: row.provider,
            payment_attempt_id: row.payment_attempt_id,
            order_id: order.order_id,
            order_number: order.order_number,
            buyer_email: order.buyer_email,
            amount_krw: toInt(order.grand_total_krw),
            currency: "KRW",
            return_urls: returnUrlsRace,
          });
          return { ok: true, body: attemptToResponse(order, row, provRace.client, true) };
        }
        return { ok: false, reason: "idempotency_incompatible", details: { status: row.status } };
      } finally {
        c2.release();
      }
    }
    return { ok: false, reason: "db_error" };
  } finally {
    client.release();
  }
}
