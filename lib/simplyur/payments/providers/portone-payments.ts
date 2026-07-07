import type {
  BongsimPaymentProviderAdapter,
  BongsimPaymentProviderCreateInput,
  BongsimPaymentProviderCreateResult,
} from "@/lib/bongsim/payments/provider-types";
import { buildSimplyurPortonePaymentId } from "@/lib/simplyur/payments/portone-payment-id";
import {
  resolvePortoneChannelKey,
  resolvePortoneCoreEnv,
  resolveSimplyurPortoneWebhookUrl,
} from "@/lib/simplyur/payments/portone-env";
import { krwOrderTotalToUsdMinor } from "@/lib/simplyur/payments/portone-methods";

export const SIMPLYUR_PORTONE_PROVIDER_ID = "portone" as const;

function simplyurOrderName(orderNumber: string): string {
  return `simplyur Korea eSIM (${orderNumber})`;
}

function portoneLocaleForSimplyur(locale: string | undefined): string {
  switch (locale) {
    case "zh":
      return "ZH_CN";
    case "zh-TW":
      return "ZH_TW";
    case "ja":
    case "vi":
    case "en":
    default:
      return "EN_US";
  }
}

/**
 * simplyur PortOne V2 — PayPal (loadPaymentUI) or KICC overseas (requestPayment).
 * REGRESSION-FREEZE[simplyur-portone-checkout-p2]: simplyur PG adapter — manifest
 * REGRESSION-FREEZE[simplyur-portone-overseas-pg]: PayPal + KICC USD charge — manifest
 */
export class SimplyurPortonePaymentsProvider implements BongsimPaymentProviderAdapter {
  readonly id = SIMPLYUR_PORTONE_PROVIDER_ID;

  async createSession(input: BongsimPaymentProviderCreateInput): Promise<BongsimPaymentProviderCreateResult> {
    const resolved = resolvePortoneCoreEnv();
    if (!resolved.ok) {
      throw new Error(`[simplyur:portone] missing env: ${resolved.missing.join(", ")}`);
    }

    const method = input.simplyur_portone?.method;
    if (!method) {
      throw new Error("[simplyur:portone] simplyur_portone.method required");
    }

    const channelKey = resolvePortoneChannelKey(method);
    if (!channelKey) {
      throw new Error(`[simplyur:portone] channel key missing for method=${method}`);
    }

    const paymentId = buildSimplyurPortonePaymentId(input.order_number, input.payment_attempt_id);
    const publicRef = `po_${input.payment_attempt_id.replace(/-/g, "").slice(0, 8)}`;
    const totalAmountMinor = krwOrderTotalToUsdMinor(input.amount_krw);
    const noticeUrl = resolveSimplyurPortoneWebhookUrl() ?? undefined;
    const portoneLocale =
      method === "paypal" ? undefined : portoneLocaleForSimplyur(input.simplyur_portone?.locale);

    return {
      provider_session_id: paymentId,
      client: {
        kind: "portone_v2",
        public_session_ref: publicRef,
        store_id: resolved.env.storeId,
        channel_key: channelKey,
        payment_id: paymentId,
        order_name: simplyurOrderName(input.order_number),
        total_amount_minor: totalAmountMinor,
        charge_currency: "USD",
        portone_method: method,
        customer_email: input.buyer_email,
        is_test_channel: resolved.env.isTestChannel,
        ...(portoneLocale ? { portone_locale: portoneLocale } : {}),
        ...(noticeUrl ? { notice_url: noticeUrl } : {}),
      },
    };
  }
}
