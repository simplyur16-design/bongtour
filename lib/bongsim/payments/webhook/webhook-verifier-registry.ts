/**
 * Inbound payment webhook verification — **실 PG 웹훅 서명 검증 교체 지점**.
 *
 * - Mock: `mock-webhook-adapter.ts` (`BONGSIM_MOCK_WEBHOOK_SECRET`, 헤더 `x-bongsim-mock-webhook-secret`).
 * - 실 PG: 라우트 `provider` 분기 추가 후 공급사 SDK/서명 문서에 맞춰 검증 구현.
 */
import { isMockProviderRoute, verifyMockWebhookRequest } from "@/lib/bongsim/payments/webhook/mock-webhook-adapter";

export function isPaymentWebhookProviderSupported(provider: string): boolean {
  return isMockProviderRoute(provider);
}

export function verifyPaymentWebhookHeaders(provider: string, headers: Headers): boolean {
  if (isMockProviderRoute(provider)) {
    return verifyMockWebhookRequest(headers);
  }
  return false;
}
