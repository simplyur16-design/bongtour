/**
 * Payment PG adapter registry — **real PG 교체 지점**.
 *
 * - 구현: `BongsimPaymentProviderAdapter` (`provider-types.ts`)를 만족하는 클래스를 등록.
 * - 기본 mock: `bongsim_mock` → `BongsimMockPaymentProvider`.
 * - 웰컴: `welcomepay` → `WelcomepayPaymentsProvider`.
 *
 * 관련 env 요약: `lib/bongsim/integration/env-contract.ts`
 */
import type { BongsimPaymentProviderAdapter } from "@/lib/bongsim/payments/provider-types";
import { BongsimMockPaymentProvider } from "@/lib/bongsim/payments/providers/bongsim-mock";
import { WelcomepayPaymentsProvider } from "@/lib/bongsim/payments/providers/welcomepay-payments";

export const BONGSIM_KNOWN_PAYMENT_PROVIDER_IDS = ["bongsim_mock", "welcomepay"] as const;

export function getPaymentProviderAdapter(providerId: string): BongsimPaymentProviderAdapter | null {
  if (providerId === "bongsim_mock") return new BongsimMockPaymentProvider();
  if (providerId === "welcomepay") return new WelcomepayPaymentsProvider();
  return null;
}
