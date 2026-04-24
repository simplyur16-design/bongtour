/**
 * Payment PG adapter registry — **real PG 교체 지점**.
 *
 * - 구현: `BongsimPaymentProviderAdapter` (`provider-types.ts`)를 만족하는 클래스를 등록.
 * - 기본 mock: `bongsim_mock` → `BongsimMockPaymentProvider`.
 * - 토스: `toss_payments` → `TossPaymentsProvider`.
 *
 * 관련 env 요약: `lib/bongsim/integration/env-contract.ts`
 */
import type { BongsimPaymentProviderAdapter } from "@/lib/bongsim/payments/provider-types";
import { BongsimMockPaymentProvider } from "@/lib/bongsim/payments/providers/bongsim-mock";
import { TossPaymentsProvider } from "@/lib/bongsim/payments/providers/toss-payments";

export const BONGSIM_KNOWN_PAYMENT_PROVIDER_IDS = ["bongsim_mock", "toss_payments"] as const;

export function getPaymentProviderAdapter(providerId: string): BongsimPaymentProviderAdapter | null {
  if (providerId === "bongsim_mock") return new BongsimMockPaymentProvider();
  if (providerId === "toss_payments") return new TossPaymentsProvider();
  return null;
}
