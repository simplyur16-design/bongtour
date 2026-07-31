import type {
  BongsimPaymentProviderAdapter,
  BongsimPaymentProviderCreateInput,
  BongsimPaymentProviderCreateResult,
} from "@/lib/bongsim/payments/provider-types";
import {
  resolveEximbayEnv,
  resolveSimplyurEximbayReturnUrl,
  resolveSimplyurEximbayStatusUrl,
} from "@/lib/simplyur/payments/eximbay-env";
import {
  buildEximbayReadyRequestBody,
  callEximbayPaymentsReady,
  mapSimplyurLocaleToEximbayLang,
  toEximbayRequestPayPayload,
} from "@/lib/simplyur/payments/eximbay-ready";
import { krwOrderTotalToUsdMinorResolved } from "@/lib/simplyur/payments/portone-methods";
import { SIMPLYUR_EXIMBAY_PROVIDER_ID } from "@/lib/simplyur/payments/providers/eximbay-provider-id";

export { SIMPLYUR_EXIMBAY_PROVIDER_ID };

// REGRESSION-FREEZE[simplyur-eximbay-live-checkout]: Eximbay live PG adapter — manifest

/**
 * Simplyur Eximbay payment-window — FGKey ready in session create, browser request_pay.
 */
export class SimplyurEximbayPaymentsProvider implements BongsimPaymentProviderAdapter {
  readonly id = SIMPLYUR_EXIMBAY_PROVIDER_ID;

  async createSession(input: BongsimPaymentProviderCreateInput): Promise<BongsimPaymentProviderCreateResult> {
    const resolved = resolveEximbayEnv();
    if (!resolved.ok) {
      throw new Error(`[simplyur:eximbay] missing env: ${resolved.missing.join(", ")}`);
    }

    const statusUrl = resolveSimplyurEximbayStatusUrl();
    if (!statusUrl) {
      throw new Error("[simplyur:eximbay] NEXT_PUBLIC_SITE_URL (or APP/NEXTAUTH) required for status_url");
    }

    const locale = input.simplyur_locale ?? input.simplyur_portone?.locale ?? "en";
    const returnBase = resolveSimplyurEximbayReturnUrl(locale);
    if (!returnBase) {
      throw new Error("[simplyur:eximbay] NEXT_PUBLIC_SITE_URL (or APP/NEXTAUTH) required for return_url");
    }
    // Cancel/fail resume (checkout?failed=1) — eximbay-return branches on rescode.
    const cancelResume = input.return_urls.cancel_url || input.return_urls.fail_url;
    const returnUrl = `${returnBase}?su_cancel=${encodeURIComponent(cancelResume)}`;
    const usdMinor = await krwOrderTotalToUsdMinorResolved(input.amount_krw);
    const buyerName = (input.buyer_email.split("@")[0] || "guest").slice(0, 100);

    // Eximbay payment.order_id — look up via order_number on status_url.
    const eximbayOrderId = input.order_number.slice(0, 50);
    const requestBody = buildEximbayReadyRequestBody({
      mid: resolved.env.mid,
      orderId: eximbayOrderId,
      amountUsdMinor: usdMinor,
      buyerName,
      buyerEmail: input.buyer_email,
      lang: mapSimplyurLocaleToEximbayLang(locale),
      returnUrl,
      statusUrl,
    });

    const ready = await callEximbayPaymentsReady(requestBody);
    if (!ready.ok) {
      throw new Error(
        `[simplyur:eximbay] ready failed: ${ready.reason}${ready.rescode ? `/${ready.rescode}` : ""}${ready.resmsg ? ` ${ready.resmsg}` : ""}`,
      );
    }

    const requestPay = toEximbayRequestPayPayload(ready.fgkey, ready.requestBody);
    const publicRef = `ex_${input.payment_attempt_id.replace(/-/g, "").slice(0, 8)}`;

    return {
      provider_session_id: eximbayOrderId,
      client: {
        kind: "eximbay_v2",
        public_session_ref: publicRef,
        sdk_script_url: ready.env.sdkScriptUrl,
        request_pay: requestPay,
        order_name: `simplyur Korea eSIM (${input.order_number})`,
        customer_email: input.buyer_email,
        is_test: resolved.env.mode === "test",
      },
    };
  }
}
