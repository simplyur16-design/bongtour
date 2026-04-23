/** PG 세션 생성 어댑터. 구현 등록: `payments/payment-provider-registry.ts`. */
import type { BongsimPaymentReturnUrlsV1 } from "@/lib/bongsim/contracts/payment-integration.v1";
import type { BongsimPaymentSessionClientV1 } from "@/lib/bongsim/contracts/payment-session.v1";

export type BongsimPaymentProviderCreateInput = {
  provider: string;
  payment_attempt_id: string;
  order_id: string;
  order_number: string;
  buyer_email: string;
  amount_krw: number;
  currency: "KRW";
  return_urls: BongsimPaymentReturnUrlsV1;
};

export type BongsimPaymentProviderCreateResult = {
  provider_session_id: string | null;
  /** Non-sensitive hints for the HTTP client (paths, refs). */
  client: BongsimPaymentSessionClientV1;
};

export interface BongsimPaymentProviderAdapter {
  readonly id: string;
  createSession(input: BongsimPaymentProviderCreateInput): Promise<BongsimPaymentProviderCreateResult>;
}
