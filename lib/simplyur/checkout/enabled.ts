// REGRESSION-FREEZE[simplyur-portone-checkout-p2]: checkout env gate — manifest

function truthyEnv(v: string | undefined): boolean {
  const s = (v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

/** Server-side simplyur checkout (Eximbay) gate. */
export function isSimplyurCheckoutEnabled(): boolean {
  return (
    truthyEnv(process.env.SIMPLYUR_CHECKOUT_ENABLED) ||
    truthyEnv(process.env.NEXT_PUBLIC_SIMPLYUR_CHECKOUT_ENABLED)
  );
}

/** Client bundle — NEXT_PUBLIC only. */
export function isSimplyurCheckoutEnabledClient(): boolean {
  return truthyEnv(process.env.NEXT_PUBLIC_SIMPLYUR_CHECKOUT_ENABLED);
}
