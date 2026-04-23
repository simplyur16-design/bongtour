import { isNodeProduction } from "@/lib/bongsim/runtime/node-env";

/**
 * Mock redirect + mock capture + `/checkout/payment/mock` are allowed only in non-production,
 * or in production when explicitly opted in (staging / disaster drills only).
 *
 * Env: `BONGSIM_ALLOW_MOCK_CAPTURE=1`
 */
export function isMockPaymentCaptureAllowed(): boolean {
  if (!isNodeProduction()) return true;
  return process.env.BONGSIM_ALLOW_MOCK_CAPTURE === "1";
}
