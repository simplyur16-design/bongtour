import { getPgPool } from "@/lib/bongsim/db/pool";
import { fetchPortonePaymentSnapshot, isPortonePaidStatus } from "@/lib/simplyur/payments/portone-api";
import { krwOrderTotalToUsdMinor } from "@/lib/simplyur/payments/portone-methods";
import { processPortonePaymentOutcome } from "@/lib/simplyur/payments/process-portone-payment-outcome";
import { SIMPLYUR_PORTONE_PROVIDER_ID } from "@/lib/simplyur/payments/providers/portone-payments";

// REGRESSION-FREEZE[simplyur-portone-overseas-pg]: shared PortOne verify + capture — manifest

export type VerifyCapturePortoneResult =
  | {
      ok: true;
      duplicate: boolean;
      order_id: string;
      order_number: string;
      payment_attempt_id: string;
    }
  | {
      ok: false;
      error:
        | "unknown_attempt"
        | "payment_id_mismatch"
        | "portone_lookup_failed"
        | "payment_not_paid"
        | "amount_mismatch"
        | "currency_mismatch"
        | "db_error";
      status?: string;
      dev_detail?: string;
    };

export async function verifyAndCapturePortonePayment(input: {
  paymentId: string;
  paymentAttemptId?: string;
}): Promise<VerifyCapturePortoneResult> {
  const paymentId = input.paymentId.trim();
  if (!paymentId) {
    return { ok: false, error: "payment_id_mismatch" };
  }

  const pool = getPgPool();
  if (!pool) return { ok: false, error: "db_error" };

  let paymentAttemptId = input.paymentAttemptId?.trim() ?? "";

  if (!paymentAttemptId) {
    const byPayment = await pool.query<{ payment_attempt_id: string }>(
      `SELECT payment_attempt_id::text
       FROM bongsim_payment_attempt
       WHERE provider = $1 AND provider_session_id = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [SIMPLYUR_PORTONE_PROVIDER_ID, paymentId],
    );
    paymentAttemptId = byPayment.rows[0]?.payment_attempt_id ?? "";
    if (!paymentAttemptId) return { ok: false, error: "unknown_attempt" };
  }

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
    return { ok: false, error: "unknown_attempt" };
  }
  if (attempt.provider_session_id !== paymentId) {
    return { ok: false, error: "payment_id_mismatch" };
  }

  const snapshot = await fetchPortonePaymentSnapshot(paymentId);
  if (!snapshot) {
    return { ok: false, error: "portone_lookup_failed" };
  }
  if (!isPortonePaidStatus(snapshot.status)) {
    return { ok: false, error: "payment_not_paid", status: snapshot.status };
  }

  const expectedKrw = Number.parseInt(attempt.amount_krw, 10);
  const expectedUsdMinor = krwOrderTotalToUsdMinor(expectedKrw);
  if (!Number.isFinite(expectedKrw) || snapshot.totalAmount !== expectedUsdMinor) {
    return { ok: false, error: "amount_mismatch" };
  }
  if (snapshot.currency && snapshot.currency !== "USD") {
    return { ok: false, error: "currency_mismatch" };
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
    return {
      ok: false,
      error:
        fin.reason === "unknown_attempt"
          ? "unknown_attempt"
          : fin.reason === "amount_mismatch"
            ? "amount_mismatch"
            : "db_error",
      dev_detail: fin.devDetail,
    };
  }

  return {
    ok: true,
    duplicate: fin.duplicate,
    order_id: attempt.order_id,
    order_number: attempt.order_number,
    payment_attempt_id: paymentAttemptId,
  };
}
