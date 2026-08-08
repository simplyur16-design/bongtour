import type { BongsimPaymentReturnUrlsV1 } from "@/lib/bongsim/contracts/payment-integration.v1";
import type { BongsimPaymentSessionRequestV1 } from "@/lib/bongsim/contracts/payment-session.v1";
import type { BongsimPaymentProviderCreateInput } from "@/lib/bongsim/payments/provider-types";

// REGRESSION-FREEZE[bongsim-simplyur-payment-channel-gate]: shared createSession input (race=happy) — manifest

function simplyurPortoneCreateOpts(req: BongsimPaymentSessionRequestV1) {
  if (!req.simplyur_portone_method) return undefined;
  return {
    method: req.simplyur_portone_method,
    locale: req.simplyur_locale,
  };
}

function toInt(n: string | number): number {
  return typeof n === "string" ? Number.parseInt(n, 10) : Math.trunc(Number(n));
}

/** Happy / reuse / 23505 race — identical simplyur_locale·eximbay_ostype·portone opts. */
export function buildPaymentProviderCreateInput(args: {
  provider: string;
  payment_attempt_id: string;
  order_id: string;
  order_number: string;
  buyer_email: string;
  amount_krw: string | number;
  return_urls: BongsimPaymentReturnUrlsV1;
  req: BongsimPaymentSessionRequestV1;
}): BongsimPaymentProviderCreateInput {
  return {
    provider: args.provider,
    payment_attempt_id: args.payment_attempt_id,
    order_id: args.order_id,
    order_number: args.order_number,
    buyer_email: args.buyer_email,
    amount_krw: toInt(args.amount_krw),
    currency: "KRW",
    return_urls: args.return_urls,
    simplyur_portone: simplyurPortoneCreateOpts(args.req),
    simplyur_locale: args.req.simplyur_locale,
    eximbay_ostype: args.req.eximbay_ostype,
    eximbay_transaction_type: args.req.eximbay_transaction_type,
  };
}
