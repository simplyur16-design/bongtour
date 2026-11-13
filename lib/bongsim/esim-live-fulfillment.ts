import { isBongsimCheckoutTestMode } from "@/lib/bongsim/test-mode";

/**
 * Real USIMSA issuance and customer Solapi SMS.
 * Allowed only when checkout test mode is off, WelcomePay is production,
 * and USIMSA is not pointed at a non-production env.
 * Unset `USIMSA_ENV` follows the supplier client default (production).
 * Unset `WELCOMEPAY_ENV` follows `resolveWelcomepayEnv`: production only when NODE_ENV is production.
 * REGRESSION-FREEZE[esim-sandbox-no-live-issue-sms]: sandbox never calls live issue or SMS — manifest
 */
export function isEsimLiveIssuanceAndSmsAllowed(): boolean {
  if (isBongsimCheckoutTestMode()) return false;
  if (welcomepayEnvIsSandbox()) return false;
  if (usimsaEnvIsSandbox()) return false;
  return true;
}

function welcomepayEnvIsSandbox(): boolean {
  const raw = (process.env.WELCOMEPAY_ENV ?? "").trim().toLowerCase();
  if (raw === "production" || raw === "prod" || raw === "live") return false;
  if (raw === "test" || raw === "sandbox" || raw === "dev" || raw === "development") return true;
  return process.env.NODE_ENV !== "production";
}

function usimsaEnvIsSandbox(): boolean {
  const raw = (process.env.USIMSA_ENV ?? "").trim().toLowerCase();
  if (!raw) return false;
  return raw !== "production" && raw !== "prod" && raw !== "live";
}
