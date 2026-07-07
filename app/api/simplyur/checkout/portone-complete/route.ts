import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { isSimplyurCheckoutEnabled } from "@/lib/simplyur/checkout/enabled";
import { verifyAndCapturePortonePayment } from "@/lib/simplyur/payments/complete-portone-capture";
import { resolvePortoneCoreEnv } from "@/lib/simplyur/payments/portone-env";

// REGRESSION-FREEZE[simplyur-portone-checkout-p2]: PortOne server verify + capture — manifest
// REGRESSION-FREEZE[simplyur-portone-overseas-pg]: USD verify via complete-portone-capture — manifest

type CompleteBody = {
  payment_id?: string;
  payment_attempt_id?: string;
};

export async function POST(req: Request) {
  const leakCtx = "simplyur.checkout.portone-complete";

  if (!isSimplyurCheckoutEnabled()) {
    return jsonWithLeakGuard({ ok: false, error: "checkout_disabled" }, leakCtx, { status: 503 });
  }

  if (!resolvePortoneCoreEnv().ok) {
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

  const fin = await verifyAndCapturePortonePayment({ paymentId, paymentAttemptId });
  if (!fin.ok) {
    const status =
      fin.error === "unknown_attempt"
        ? 404
        : fin.error === "portone_lookup_failed"
          ? 502
          : fin.error === "payment_not_paid" ||
              fin.error === "amount_mismatch" ||
              fin.error === "currency_mismatch" ||
              fin.error === "payment_id_mismatch"
            ? 400
            : fin.error === "db_error"
              ? 503
              : 500;
    return jsonWithLeakGuard(
      { ok: false, error: fin.error, status: fin.status, dev_detail: fin.dev_detail },
      leakCtx,
      { status },
    );
  }

  return jsonWithLeakGuard(
    {
      ok: true,
      duplicate: fin.duplicate,
      order_id: fin.order_id,
      order_number: fin.order_number,
    },
    leakCtx,
  );
}
