export function isBongsimCheckoutTestMode(): boolean {
  return (process.env.BONGSIM_CHECKOUT_TEST_MODE ?? "").trim().toLowerCase() === "true";
}
