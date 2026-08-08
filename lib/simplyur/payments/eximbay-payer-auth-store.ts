/**
 * Persist PAYER_AUTH id on payment attempt until /v1/payments/confirm.
 * REGRESSION-FREEZE[simplyur-eximbay-payer-auth-pa]: last_error payer_auth store — manifest
 */
import { getPgPool } from "@/lib/bongsim/db/pool";
import { SIMPLYUR_EXIMBAY_PROVIDER_ID } from "@/lib/simplyur/payments/providers/eximbay-provider-id";

export const EXIMBAY_PAYER_AUTH_LAST_ERROR_KIND = "eximbay_payer_auth" as const;

export type EximbayPayerAuthLastError = {
  kind: typeof EXIMBAY_PAYER_AUTH_LAST_ERROR_KIND;
  payer_auth_id: string;
  stored_at: string;
};

export function parseEximbayPayerAuthFromLastError(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.kind !== EXIMBAY_PAYER_AUTH_LAST_ERROR_KIND) return null;
  const id = typeof o.payer_auth_id === "string" ? o.payer_auth_id.trim() : "";
  return id || null;
}

export async function storeEximbayPayerAuthId(input: {
  eximbayOrderId: string;
  payerAuthId: string;
}): Promise<{ ok: true } | { ok: false; reason: "db_unconfigured" | "unknown_attempt" | "db_error" }> {
  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured" };
  const orderKey = input.eximbayOrderId.trim();
  const payerAuthId = input.payerAuthId.trim();
  if (!orderKey || !payerAuthId) return { ok: false, reason: "unknown_attempt" };

  const payload: EximbayPayerAuthLastError = {
    kind: EXIMBAY_PAYER_AUTH_LAST_ERROR_KIND,
    payer_auth_id: payerAuthId.slice(0, 64),
    stored_at: new Date().toISOString(),
  };

  try {
    const r = await pool.query(
      `UPDATE bongsim_payment_attempt a
       SET last_error = $3::jsonb, updated_at = now()
       FROM bongsim_order o
       WHERE a.order_id = o.order_id
         AND a.provider = $1
         AND (a.provider_session_id = $2 OR o.order_number = $2)
         AND a.status NOT IN ('captured', 'refunded', 'cancelled')`,
      [SIMPLYUR_EXIMBAY_PROVIDER_ID, orderKey, JSON.stringify(payload)],
    );
    if ((r.rowCount ?? 0) < 1) return { ok: false, reason: "unknown_attempt" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "db_error" };
  }
}

export async function loadEximbayPayerAuthIdForAttempt(paymentAttemptId: string): Promise<string | null> {
  const pool = getPgPool();
  if (!pool) return null;
  const r = await pool.query<{ last_error: unknown }>(
    `SELECT last_error FROM bongsim_payment_attempt WHERE payment_attempt_id = $1::uuid LIMIT 1`,
    [paymentAttemptId],
  );
  return parseEximbayPayerAuthFromLastError(r.rows[0]?.last_error);
}
