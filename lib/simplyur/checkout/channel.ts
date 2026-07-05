export const SIMPLYUR_CHECKOUT_CHANNELS = ["simplyur_web", "simplyur_app"] as const;
export type SimplyurCheckoutChannel = (typeof SIMPLYUR_CHECKOUT_CHANNELS)[number];

export function isSimplyurCheckoutChannel(channel: string | undefined | null): channel is SimplyurCheckoutChannel {
  const c = (channel ?? "").trim();
  return c === "simplyur_web" || c === "simplyur_app" || c.startsWith("simplyur_");
}

export const SIMPLYUR_CHECKOUT_TERMS_VERSION = "simplyur-v1" as const;
