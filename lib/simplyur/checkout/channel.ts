import { readBearerToken } from "@/lib/simplyur/auth/mobile-access-token";

export const SIMPLYUR_CHECKOUT_CHANNELS = ["simplyur_web", "simplyur_app"] as const;
export type SimplyurCheckoutChannel = (typeof SIMPLYUR_CHECKOUT_CHANNELS)[number];

export function isSimplyurCheckoutChannel(channel: string | undefined | null): channel is SimplyurCheckoutChannel {
  const c = (channel ?? "").trim();
  return c === "simplyur_web" || c === "simplyur_app" || c.startsWith("simplyur_");
}

/**
 * App vs web channel for simplyur confirm.
 * Bearer mobile session ⇒ simplyur_app; otherwise body hint or simplyur_web.
 * REGRESSION-FREEZE[simplyur-checkout-channel-locale]: channel resolution — manifest
 */
export function resolveSimplyurCheckoutChannel(args: {
  req: Request;
  bodyChannel?: string | null;
}): SimplyurCheckoutChannel {
  if (readBearerToken(args.req)) return "simplyur_app";
  const fromBody = (args.bodyChannel ?? "").trim();
  if (fromBody === "simplyur_app" || fromBody === "simplyur_web") return fromBody;
  return "simplyur_web";
}

/** Bongsim `buyer_locale` is ko|en only; simplyur UI locale lives in consents.simplyur_locale. */
export function simplyurBuyerLocaleForOrder(): "en" {
  return "en";
}

export const SIMPLYUR_CHECKOUT_TERMS_VERSION = "simplyur-v1" as const;
