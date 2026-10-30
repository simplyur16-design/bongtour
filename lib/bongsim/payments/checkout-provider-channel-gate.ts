import { isSimplyurCheckoutChannel } from "@/lib/simplyur/checkout/channel";
import { SIMPLYUR_EXIMBAY_PROVIDER_ID } from "@/lib/simplyur/payments/providers/eximbay-provider-id";

// REGRESSION-FREEZE[bongsim-simplyur-payment-channel-gate]: channel×PG matrix — manifest

export type CheckoutProviderChannelGateResult =
  | { ok: true }
  | { ok: false; providerDetail: string };

/**
 * Bongtour WelcomePay vs Simplyur Eximbay — shared session must not cross channels.
 */
export function assertCheckoutProviderAllowed(
  provider: string,
  checkoutChannel: string | null | undefined,
): CheckoutProviderChannelGateResult {
  const simplyur = isSimplyurCheckoutChannel(checkoutChannel);
  if (provider === SIMPLYUR_EXIMBAY_PROVIDER_ID && !simplyur) {
    return {
      ok: false,
      providerDetail: "eximbay_simplyur_orders_only",
    };
  }
  // Simplyur foreigners eSIM: Welcomepay (Bongtour) forbidden.
  if (provider === "welcomepay" && simplyur) {
    return { ok: false, providerDetail: "welcomepay_not_for_simplyur" };
  }
  return { ok: true };
}
