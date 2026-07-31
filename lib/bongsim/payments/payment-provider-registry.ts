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
import {
  SIMPLYUR_EXIMBAY_PROVIDER_ID,
  SimplyurEximbayPaymentsProvider,
} from "@/lib/simplyur/payments/providers/eximbay-payments";
import {
  SIMPLYUR_PORTONE_PROVIDER_ID,
  SimplyurPortonePaymentsProvider,
} from "@/lib/simplyur/payments/providers/portone-payments";

export const BONGSIM_KNOWN_PAYMENT_PROVIDER_IDS = [
  "bongsim_mock",
  "welcomepay",
  "portone",
  "eximbay",
] as const;

export function getPaymentProviderAdapter(providerId: string): BongsimPaymentProviderAdapter | null {
  if (providerId === "bongsim_mock") return new BongsimMockPaymentProvider();
  if (providerId === "welcomepay") return new WelcomepayPaymentsProvider();
  if (providerId === SIMPLYUR_PORTONE_PROVIDER_ID) return new SimplyurPortonePaymentsProvider();
  if (providerId === SIMPLYUR_EXIMBAY_PROVIDER_ID) return new SimplyurEximbayPaymentsProvider();
  return null;
}
