import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { isSimplyurCheckoutChannel } from "@/lib/simplyur/checkout/channel";
import { isSimplyurCheckoutEnabled } from "@/lib/simplyur/checkout/enabled";
import {
  isSimplyurEximbayPrepUiEnabled,
  resolveEximbayEnv,
  resolveSimplyurEximbayReturnUrl,
  resolveSimplyurEximbayStatusUrl,
} from "@/lib/simplyur/payments/eximbay-env";
import {
  buildEximbayReadyRequestBody,
  callEximbayPaymentsReady,
  krwOrderTotalToEximbayUsdAmountResolved,
  mapSimplyurLocaleToEximbayLang,
  toEximbayRequestPayPayload,
  formatEximbayUsdAmountFromMinor,
} from "@/lib/simplyur/payments/eximbay-ready";
import { krwOrderTotalToUsdMinorResolved } from "@/lib/simplyur/payments/portone-methods";
import { isNodeProduction } from "@/lib/bongsim/runtime/node-env";

// REGRESSION-FREEZE[simplyur-eximbay-payment-prep]: simplyur checkout eximbay-ready — manifest

type ReadyBody = {
  order_id?: string;
  payment_attempt_id?: string;
  buyer_name?: string;
  buyer_email?: string;
  locale?: string;
  /** Prep smoke only — $1.00 FGKey test when SIMPLYUR_EXIMBAY_PREP_UI=1 and non-production */
  smoke?: boolean;
};

type OrderRow = {
  order_id: string;
  order_number: string;
  status: string;
  buyer_email: string;
  grand_total_krw: string;
  checkout_channel: string;
};

export async function POST(req: Request) {
  const leakCtx = "simplyur.checkout.eximbay-ready";

  if (!isSimplyurCheckoutEnabled() && !isSimplyurEximbayPrepUiEnabled()) {
    return jsonWithLeakGuard({ ok: false, error: "checkout_disabled" }, leakCtx, { status: 503 });
  }

  const envResolved = resolveEximbayEnv();
  if (!envResolved.ok) {
    return jsonWithLeakGuard(
      { ok: false, error: "eximbay_env_incomplete", missing: envResolved.missing },
      leakCtx,
      { status: 503 },
    );
  }

  let body: ReadyBody;
  try {
    body = (await req.json()) as ReadyBody;
  } catch {
    return jsonWithLeakGuard({ ok: false, error: "invalid_json" }, leakCtx, { status: 400 });
  }

  const locale = typeof body.locale === "string" ? body.locale.trim() : "en";
  const returnUrl = resolveSimplyurEximbayReturnUrl(locale);
  const statusUrl = resolveSimplyurEximbayStatusUrl();
  if (!returnUrl || !statusUrl) {
    return jsonWithLeakGuard(
      { ok: false, error: "site_url_missing", hint: "NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_SITE_URL" },
      leakCtx,
      { status: 503 },
    );
  }

  const smoke = body.smoke === true;
  if (smoke) {
    if (!isSimplyurEximbayPrepUiEnabled() || isNodeProduction()) {
      return jsonWithLeakGuard({ ok: false, error: "smoke_not_allowed" }, leakCtx, { status: 403 });
    }
    const orderId = `smoke-${Date.now()}`.slice(0, 50);
    const requestBody = buildEximbayReadyRequestBody({
      mid: envResolved.env.mid,
      orderId,
      amountUsdMinor: 100,
      buyerName: (typeof body.buyer_name === "string" && body.buyer_name.trim()) || "eximbay",
      buyerEmail:
        (typeof body.buyer_email === "string" && body.buyer_email.trim()) || "test@eximbay.com",
      lang: mapSimplyurLocaleToEximbayLang(locale),
      returnUrl,
      statusUrl,
    });
    const ready = await callEximbayPaymentsReady(requestBody);
    if (!ready.ok) {
      return jsonWithLeakGuard(
        {
          ok: false,
          error: ready.reason,
          rescode: ready.rescode,
          resmsg: ready.resmsg,
          detail: ready.detail,
        },
        leakCtx,
        { status: 502 },
      );
    }
    return jsonWithLeakGuard(
      {
        ok: true,
        smoke: true,
        sdk_script_url: ready.env.sdkScriptUrl,
        request_pay: toEximbayRequestPayPayload(ready.fgkey, ready.requestBody),
      },
      leakCtx,
    );
  }

  if (!getPgPool()) {
    return jsonWithLeakGuard({ ok: false, error: "db_unconfigured" }, leakCtx, { status: 503 });
  }

  const orderId = typeof body.order_id === "string" ? body.order_id.trim() : "";
  const attemptId =
    typeof body.payment_attempt_id === "string" ? body.payment_attempt_id.trim() : "";
  if (!orderId && !attemptId) {
    return jsonWithLeakGuard({ ok: false, error: "missing_order" }, leakCtx, { status: 400 });
  }

  const pool = getPgPool()!;
  let order: OrderRow | null = null;
  try {
    if (attemptId) {
      const r = await pool.query<OrderRow>(
        `SELECT o.order_id, o.order_number, o.status, o.buyer_email, o.grand_total_krw, o.checkout_channel
         FROM bongsim_payment_attempt a
         JOIN bongsim_order o ON o.order_id = a.order_id
         WHERE a.payment_attempt_id = $1
         LIMIT 1`,
        [attemptId],
      );
      order = r.rows[0] ?? null;
    } else {
      const r = await pool.query<OrderRow>(
        `SELECT order_id, order_number, status, buyer_email, grand_total_krw, checkout_channel
         FROM bongsim_order WHERE order_id = $1 LIMIT 1`,
        [orderId],
      );
      order = r.rows[0] ?? null;
    }
  } catch {
    return jsonWithLeakGuard({ ok: false, error: "db_error" }, leakCtx, { status: 503 });
  }

  if (!order) {
    return jsonWithLeakGuard({ ok: false, error: "order_not_found" }, leakCtx, { status: 404 });
  }
  if (!isSimplyurCheckoutChannel(order.checkout_channel)) {
    return jsonWithLeakGuard(
      { ok: false, error: "not_simplyur_order", hint: "welcomepay_bongtour_orders_excluded" },
      leakCtx,
      { status: 403 },
    );
  }
  if (order.status !== "awaiting_payment") {
    return jsonWithLeakGuard(
      { ok: false, error: "order_not_payable", status: order.status },
      leakCtx,
      { status: 400 },
    );
  }

  const krw = Number.parseInt(order.grand_total_krw, 10);
  if (!Number.isFinite(krw) || krw <= 0) {
    return jsonWithLeakGuard({ ok: false, error: "invalid_amount" }, leakCtx, { status: 400 });
  }

  const buyerEmail =
    (typeof body.buyer_email === "string" && body.buyer_email.trim()) ||
    order.buyer_email?.trim() ||
    "";
  if (!buyerEmail) {
    return jsonWithLeakGuard({ ok: false, error: "buyer_email_missing" }, leakCtx, { status: 400 });
  }
  const buyerName =
    (typeof body.buyer_name === "string" && body.buyer_name.trim()) || buyerEmail.split("@")[0] || "guest";

  const usdMinor = await krwOrderTotalToUsdMinorResolved(krw);
  const requestBody = buildEximbayReadyRequestBody({
    mid: envResolved.env.mid,
    orderId: order.order_number || order.order_id,
    amountUsdMinor: usdMinor,
    buyerName,
    buyerEmail,
    lang: mapSimplyurLocaleToEximbayLang(locale),
    returnUrl,
    statusUrl,
  });

  const ready = await callEximbayPaymentsReady(requestBody);
  if (!ready.ok) {
    return jsonWithLeakGuard(
      {
        ok: false,
        error: ready.reason,
        rescode: ready.rescode,
        resmsg: ready.resmsg,
        detail: ready.detail,
      },
      leakCtx,
      { status: 502 },
    );
  }

  return jsonWithLeakGuard(
    {
      ok: true,
      order_id: order.order_id,
      order_number: order.order_number,
      amount_usd: formatEximbayUsdAmountFromMinor(usdMinor),
      amount_usd_display: await krwOrderTotalToEximbayUsdAmountResolved(krw),
      sdk_script_url: ready.env.sdkScriptUrl,
      request_pay: toEximbayRequestPayPayload(ready.fgkey, ready.requestBody),
    },
    leakCtx,
  );
}
