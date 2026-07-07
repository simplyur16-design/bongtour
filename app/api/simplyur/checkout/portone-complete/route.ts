import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { isSimplyurCheckoutEnabled } from "@/lib/simplyur/checkout/enabled";
import { fetchPortonePaymentSnapshot, isPortonePaidStatus } from "@/lib/simplyur/payments/portone-api";
import { resolvePortoneEnv } from "@/lib/simplyur/payments/portone-env";
import { processPortonePaymentOutcome } from "@/lib/simplyur/payments/process-portone-payment-outcome";
import { SIMPLYUR_PORTONE_PROVIDER_ID } from "@/lib/simplyur/payments/providers/portone-payments";

// REGRESSION-FREEZE[simplyur-portone-checkout-p2]: PortOne server verify + capture — manifest

type CompleteBody = {
  payment_id?: string;
  payment_attempt_id?: string;
};

export async function POST(req: Request) {
  const leakCtx = "simplyur.checkout.portone-complete";

  if (!isSimplyurCheckoutEnabled()) {
    return jsonWithLeakGuard({ ok: false, error: "checkout_disabled" }, leakCtx, { status: 503 });
  }

  if (!resolvePortoneEnv().ok) {
    return jsonWithLeakGuard({ ok: false, error: "portone_env_incomplete" }, leakCtx, { status: 503 });
  }

  if (!getPgPool()) {
    return jsonWithLeakGuard({ ok: false, error: "db_unconfigured" }, leakCtx, { status: 503 });
  }

  let body: CompleteBody;
  try {
    body = (await req.json()) as CompleteBody;
  } catch {
    return jsonWithLeakGuard({ ok: false, error: "invalid_json" }, leakCtx, { status: 400 });
  }

  const paymentId = typeof body.payment_id === "string" ? body.payment_id.trim() : "";
  const paymentAttemptId = typeof body.payment_attempt_id === "string" ? body.payment_attempt_id.trim() : "";
  if (!paymentId || !paymentAttemptId) {
    return jsonWithLeakGuard({ ok: false, error: "missing_fields" }, leakCtx, { status: 400 });
  }

  const pool = getPgPool()!;
  const attemptRow = await pool.query<{
    payment_attempt_id: string;
    provider: string;
    provider_session_id: string | null;
    amount_krw: string;
    order_id: string;
    order_number: string;
  }>(
    `SELECT pa.payment_attempt_id, pa.provider, pa.provider_session_id, pa.amount_krw::text AS amount_krw,
            o.order_id::text AS order_id, o.order_number
     FROM bongsim_payment_attempt pa
     JOIN bongsim_order o ON o.order_id = pa.order_id
     WHERE pa.payment_attempt_id = $1
     LIMIT 1`,
    [paymentAttemptId],
  );
  const attempt = attemptRow.rows[0];
  if (!attempt || attempt.provider !== SIMPLYUR_PORTONE_PROVIDER_ID) {
    return jsonWithLeakGuard({ ok: false, error: "unknown_attempt" }, leakCtx, { status: 404 });
  }
  if (attempt.provider_session_id !== paymentId) {
    return jsonWithLeakGuard({ ok: false, error: "payment_id_mismatch" }, leakCtx, { status: 400 });
  }

  const snapshot = await fetchPortonePaymentSnapshot(paymentId);
  if (!snapshot) {
    return jsonWithLeakGuard({ ok: false, error: "portone_lookup_failed" }, leakCtx, { status: 502 });
  }
  if (!isPortonePaidStatus(snapshot.status)) {
    return jsonWithLeakGuard(
      { ok: false, error: "payment_not_paid", status: snapshot.status },
      leakCtx,
      { status: 400 },
    );
  }

  const expectedKrw = Number.parseInt(attempt.amount_krw, 10);
  if (!Number.isFinite(expectedKrw) || snapshot.totalAmount !== expectedKrw) {
    return jsonWithLeakGuard({ ok: false, error: "amount_mismatch" }, leakCtx, { status: 400 });
  }
  if (snapshot.currency && snapshot.currency !== "KRW") {
    return jsonWithLeakGuard({ ok: false, error: "currency_mismatch" }, leakCtx, { status: 400 });
  }

  const providerEventId = snapshot.txId ? `portone_tx_${snapshot.txId}` : `portone_paid_${paymentId}`;
  const fin = await processPortonePaymentOutcome({
    providerEventId,
    paymentAttemptId,
    outcome: "captured",
    amountKrw: expectedKrw,
    paymentReference: snapshot.txId ?? paymentId,
    rawPayload: snapshot,
  });

  if (!fin.ok) {
    const status =
      fin.reason === "unknown_attempt"
        ? 404
        : fin.reason === "amount_mismatch" || fin.reason === "not_payable"
          ? 400
          : fin.reason === "db_unconfigured"
            ? 503
            : 500;
    return jsonWithLeakGuard({ ok: false, error: fin.reason, dev_detail: fin.devDetail }, leakCtx, { status });
  }

  return jsonWithLeakGuard(
    {
      ok: true,
      duplicate: fin.duplicate,
      order_id: attempt.order_id,
      order_number: attempt.order_number,
    },
    leakCtx,
  );
}
