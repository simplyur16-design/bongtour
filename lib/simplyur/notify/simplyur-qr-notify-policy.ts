import { isSimplyurCheckoutChannel } from "@/lib/simplyur/checkout/channel";
import {
  isSimplyurLocale,
  simplyurPath,
  SIMPLYUR_DEFAULT_LOCALE,
  type SimplyurLocale,
} from "@/lib/simplyur/constants";
import { getSiteOrigin } from "@/lib/site-metadata";

// REGRESSION-FREEZE[simplyur-esim-delivery-install]: simplyur notify = email + install links, no Kakao — manifest
// REGRESSION-FREEZE[simplyur-eximbay-refund]: card cancel then USIMSA — manifest

/** Operator: card (Eximbay) first, then USIMSA cancel. */
export const SIMPLYUR_REFUND_REMOTE_ORDER = ["eximbay_card_cancel", "usimsa_supplier_cancel"] as const;

/** Kakao AlimTalk is Korea-resident Bongsim. simplyur travelers: email + in-app only. */
export function simplyurNotifyRequiresKakaoPhone(
  checkoutChannel: string | null | undefined,
): boolean {
  return !isSimplyurCheckoutChannel(checkoutChannel);
}

export function simplyurLocaleFromConsents(consents: unknown): SimplyurLocale {
  if (!consents || typeof consents !== "object") return SIMPLYUR_DEFAULT_LOCALE;
  const raw = (consents as Record<string, unknown>).simplyur_locale;
  return typeof raw === "string" && isSimplyurLocale(raw) ? raw : SIMPLYUR_DEFAULT_LOCALE;
}

export function buildSimplyurMyEsimAbsoluteUrl(locale: SimplyurLocale = SIMPLYUR_DEFAULT_LOCALE): string {
  const origin = getSiteOrigin().replace(/\/$/, "");
  return `${origin}${simplyurPath(locale, "/my-esim")}`;
}
