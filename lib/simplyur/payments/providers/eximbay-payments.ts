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
  type EximbayTransactionType,
} from "@/lib/simplyur/payments/eximbay-ready";
import { krwOrderTotalToUsdMinorResolved } from "@/lib/simplyur/payments/portone-methods";
import { SIMPLYUR_EXIMBAY_PROVIDER_ID } from "@/lib/simplyur/payments/providers/eximbay-provider-id";

export { SIMPLYUR_EXIMBAY_PROVIDER_ID };

// REGRESSION-FREEZE[simplyur-eximbay-live-checkout]: Eximbay live PG adapter — manifest
// REGRESSION-FREEZE[simplyur-eximbay-payer-auth-pa]: mobile PAYER_AUTH ready — manifest

/**
 * Simplyur Eximbay — web uses PAYMENT window; mobile uses PAYER_AUTH then /v1/payments/confirm.
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
    const webReturnBase = resolveSimplyurEximbayReturnUrl(locale);
    if (!webReturnBase) {
      throw new Error("[simplyur:eximbay] NEXT_PUBLIC_SITE_URL (or APP/NEXTAUTH) required for return_url");
    }

    const txn: EximbayTransactionType =
      input.eximbay_transaction_type === "PAYER_AUTH" ? "PAYER_AUTH" : "PAYMENT";
    const authOnly = txn === "PAYER_AUTH";

    // Mobile: use app sentinel success_url so WebView never lands on website chrome.
    // Web: keep eximbay-return + cancel resume query.
    const cancelResume = input.return_urls.cancel_url || input.return_urls.fail_url;
    const successHint = (input.return_urls.success_url ?? "").trim();
    const returnUrl =
      authOnly && successHint.includes("app-pay-result")
        ? successHint
        : `${webReturnBase}?su_cancel=${encodeURIComponent(cancelResume)}`;

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
      ostype: input.eximbay_ostype ?? "M",
      transactionType: txn,
      callFromApp: authOnly,
      callFromScheme: "simplyur",
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
        ...(authOnly ? { auth_only: true } : {}),
      },
    };
  }
}
