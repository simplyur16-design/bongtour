/**
 * Payment PG adapter registry — **real PG 교체 지점**.
 *
 * - 구현: `BongsimPaymentProviderAdapter` (`provider-types.ts`)를 만족하는 클래스를 등록.
 * - 기본 mock: `bongsim_mock` → `BongsimMockPaymentProvider`.
 * - 향후: Toss/Stripe 등은 동일 시그니처로 추가 후 `getPaymentProviderAdapter`에 분기.
 *
 * 관련 env 요약: `lib/bongsim/integration/env-contract.ts`
 */
import type { BongsimPaymentProviderAdapter } from "@/lib/bongsim/payments/provider-types";
import { BongsimMockPaymentProvider } from "@/lib/bongsim/payments/providers/bongsim-mock";

export const BONGSIM_KNOWN_PAYMENT_PROVIDER_IDS = ["bongsim_mock"] as const;

export function getPaymentProviderAdapter(providerId: string): BongsimPaymentProviderAdapter | null {
  if (providerId === "bongsim_mock") return new BongsimMockPaymentProvider();
  return null;
}
