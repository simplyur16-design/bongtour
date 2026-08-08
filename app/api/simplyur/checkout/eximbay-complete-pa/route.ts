import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { resolveSimplyurApiUser } from "@/lib/simplyur/auth/resolve-simplyur-api-user";
import { isSimplyurCheckoutEnabled } from "@/lib/simplyur/checkout/enabled";
import {
  buildEximbayConfirmPaBody,
  callEximbayPaymentsConfirmPa,
} from "@/lib/simplyur/payments/eximbay-confirm-pa";
import { resolveEximbayEnv } from "@/lib/simplyur/payments/eximbay-env";
import {
  loadEximbayPayerAuthIdForAttempt,
  storeEximbayPayerAuthId,
} from "@/lib/simplyur/payments/eximbay-payer-auth-store";
import {
  formatEximbayUsdAmountFromMinor,
  mapSimplyurLocaleToEximbayLang,
} from "@/lib/simplyur/payments/eximbay-ready";
import { processEximbayPaymentOutcome } from "@/lib/simplyur/payments/process-eximbay-payment-outcome";
import { krwOrderTotalToUsdMinorResolved } from "@/lib/simplyur/payments/portone-methods";
import { SIMPLYUR_EXIMBAY_PROVIDER_ID } from "@/lib/simplyur/payments/providers/eximbay-provider-id";

// REGRESSION-FREEZE[simplyur-eximbay-payer-auth-pa]: mobile complete-pa — manifest

type CompleteBody = {
  payment_attempt_id?: string;
  order_id?: string;
  payer_auth_id?: string;
  simplyur_locale?: string;
};

export async function POST(req: Request) {
  const leakCtx = "simplyur.checkout.eximbay-complete-pa";

  if (!isSimplyurCheckoutEnabled()) {
    return jsonWithLeakGuard({ ok: false, error: "checkout_disabled" }, leakCtx, { status: 503 });
  }

  const env = resolveEximbayEnv();
  if (!env.ok) {
    return jsonWithLeakGuard({ ok: false, error: "eximbay_env_incomplete" }, leakCtx, { status: 503 });
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

  const paymentAttemptId =
    typeof body.payment_attempt_id === "string" ? body.payment_attempt_id.trim() : "";
  const orderIdHint = typeof body.order_id === "string" ? body.order_id.trim() : "";
  let payerAuthId = typeof body.payer_auth_id === "string" ? body.payer_auth_id.trim() : "";
  const locale = typeof body.simplyur_locale === "string" ? body.simplyur_locale.trim() : "en";

  if (!paymentAttemptId) {
    return jsonWithLeakGuard({ ok: false, error: "missing_fields" }, leakCtx, { status: 400 });
  }

  try {
    const pool = getPgPool()!;
    // Ownership SSOT = consents.bongtour_user_id (bongsim_order has no user_id column).
    // REGRESSION-FREEZE[simplyur-eximbay-payer-auth-pa]: consents ownership — manifest
    const attempt = await pool.query<{
      payment_attempt_id: string;
      order_id: string;
      status: string;
      amount_krw: string;
      provider: string;
      provider_session_id: string | null;
      order_number: string;
      buyer_email: string | null;
      owner_user_id: string | null;
    }>(
      `SELECT a.payment_attempt_id::text, a.order_id::text, a.status, a.amount_krw::text, a.provider,
              a.provider_session_id, o.order_number, o.buyer_email,
              NULLIF(trim(o.consents->>'bongtour_user_id'), '') AS owner_user_id
       FROM bongsim_payment_attempt a
       JOIN bongsim_order o ON o.order_id = a.order_id
       WHERE a.payment_attempt_id = $1::uuid
       LIMIT 1`,
      [paymentAttemptId],
    );
    const row = attempt.rows[0];
    if (!row || row.provider !== SIMPLYUR_EXIMBAY_PROVIDER_ID) {
      return jsonWithLeakGuard({ ok: false, error: "unknown_attempt" }, leakCtx, { status: 404 });
    }
    if (orderIdHint && orderIdHint !== row.order_id && orderIdHint !== row.order_number) {
      return jsonWithLeakGuard({ ok: false, error: "order_mismatch" }, leakCtx, { status: 400 });
    }

    // Optional ownership check when Bearer present.
    const user = await resolveSimplyurApiUser(req);
    if (user && row.owner_user_id && user.userId !== row.owner_user_id) {
      return jsonWithLeakGuard({ ok: false, error: "forbidden" }, leakCtx, { status: 403 });
    }

    if (row.status === "captured") {
      return jsonWithLeakGuard(
        {
          ok: true,
          duplicate: true,
          order_id: row.order_id,
          order_number: row.order_number,
        },
        leakCtx,
      );
    }

    if (!payerAuthId) {
      // status_url may land slightly after return_url — brief poll before failing.
      for (let i = 0; i < 8 && !payerAuthId; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 500));
        payerAuthId = (await loadEximbayPayerAuthIdForAttempt(paymentAttemptId)) ?? "";
      }
    }
    if (!payerAuthId) {
      return jsonWithLeakGuard({ ok: false, error: "missing_payer_auth_id" }, leakCtx, { status: 400 });
    }

    // Keep latest id for retries.
    await storeEximbayPayerAuthId({
      eximbayOrderId: row.provider_session_id || row.order_number,
      payerAuthId,
    });

    const usdMinor = await krwOrderTotalToUsdMinorResolved(Number(row.amount_krw));
    const confirmBody = buildEximbayConfirmPaBody({
      mid: env.env.mid,
      orderId: row.provider_session_id || row.order_number,
      amountUsd: formatEximbayUsdAmountFromMinor(usdMinor),
      payerAuthId,
      lang: mapSimplyurLocaleToEximbayLang(locale),
    });

    const confirmed = await callEximbayPaymentsConfirmPa(confirmBody);
    if (!confirmed.ok) {
      return jsonWithLeakGuard(
        {
          ok: false,
          error: confirmed.reason,
          rescode: confirmed.rescode,
          resmsg: confirmed.resmsg,
        },
        leakCtx,
        { status: confirmed.reason === "eximbay_confirm_failed" ? 400 : 502 },
      );
    }

    const eventId =
      confirmed.transactionId || `eximbay_pa_${row.order_number}_${payerAuthId}`.slice(0, 120);
    const outcome = await processEximbayPaymentOutcome({
      eximbayOrderId: row.provider_session_id || row.order_number,
      providerEventId: eventId,
      rawPayload: { confirm: confirmed.raw, payer_auth_id: payerAuthId },
    });

    if (!outcome.ok) {
      return jsonWithLeakGuard(
        { ok: false, error: outcome.reason },
        leakCtx,
        { status: outcome.reason === "unknown_attempt" ? 404 : 500 },
      );
    }

    return jsonWithLeakGuard(
      {
        ok: true,
        duplicate: outcome.duplicate,
        order_id: outcome.order_id ?? row.order_id,
        order_number: outcome.order_number ?? row.order_number,
      },
      leakCtx,
    );
  } catch (e) {
    console.error("[simplyur:eximbay-complete-pa]", e);
    return jsonWithLeakGuard({ ok: false, error: "internal" }, leakCtx, { status: 500 });
  }
}
