import { isSimplyurCheckoutChannel } from "@/lib/simplyur/checkout/channel";
import { SIMPLYUR_EXIMBAY_PROVIDER_ID } from "@/lib/simplyur/payments/providers/eximbay-provider-id";
import { SIMPLYUR_PORTONE_PROVIDER_ID } from "@/lib/simplyur/payments/providers/portone-payments";

// REGRESSION-FREEZE[bongsim-simplyur-payment-channel-gate]: channel×PG matrix — manifest

export type CheckoutProviderChannelGateResult =
  | { ok: true }
  | { ok: false; providerDetail: string };

/**
 * Bongtour WelcomePay vs Simplyur Eximbay/PortOne — shared session must not cross channels.
 */
export function assertCheckoutProviderAllowed(
  provider: string,
  checkoutChannel: string | null | undefined,
): CheckoutProviderChannelGateResult {
  const simplyur = isSimplyurCheckoutChannel(checkoutChannel);
  if (
    (provider === SIMPLYUR_EXIMBAY_PROVIDER_ID || provider === SIMPLYUR_PORTONE_PROVIDER_ID) &&
    !simplyur
  ) {
    return {
      ok: false,
      providerDetail:
        provider === SIMPLYUR_EXIMBAY_PROVIDER_ID
          ? "eximbay_simplyur_orders_only"
          : "portone_simplyur_orders_only",
    };
  }
  // Simplyur foreigners eSIM: Welcomepay (Bongtour) forbidden.
  if (provider === "welcomepay" && simplyur) {
    return { ok: false, providerDetail: "welcomepay_not_for_simplyur" };
  }
  return { ok: true };
}
