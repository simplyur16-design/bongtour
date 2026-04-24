/**
 * Toss Payments webhook parser.
 *
 * 토스는 Stripe처럼 HMAC 서명을 제공하지 않으므로, 수신한 paymentKey를 가지고
 * 토스 API에 다시 조회하는 "double-check" 방식으로 신뢰성을 확보한다.
 * 이 방식은 토스 공식 가이드 권장 방식.
 */

import { retrieveTossPayment } from "@/lib/bongsim/payments/toss/client";
import type { TossPaymentObject } from "@/lib/bongsim/payments/toss/types";

/**
 * 토스 웹훅 이벤트 타입 (사용하는 것만).
 * 전체 목록: https://docs.tosspayments.com/guides/webhook
 */
export type TossWebhookEventType =
  | "PAYMENT_STATUS_CHANGED"
  | "DEPOSIT_CALLBACK"
  | "CANCEL_STATUS_CHANGED"
  | string;

export type TossWebhookBody = {
  eventType: TossWebhookEventType;
  createdAt: string;
  /**
   * data는 이벤트 타입별로 다름. 핵심 필드만 옮겨 옴.
   * PAYMENT_STATUS_CHANGED 의 data는 Payment 객체 유사.
   */
  data: {
    paymentKey?: string;
    orderId?: string;
    status?: string;
    secret?: string;
    [key: string]: unknown;
  };
};

export type ParseResult =
  | { ok: true; body: TossWebhookBody }
  | { ok: false; error: string };

export function parseTossWebhookBody(body: unknown): ParseResult {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  const o = body as Record<string, unknown>;
  const eventType = typeof o.eventType === "string" ? o.eventType : "";
  const createdAt = typeof o.createdAt === "string" ? o.createdAt : "";
  const data = o.data && typeof o.data === "object" ? (o.data as Record<string, unknown>) : null;
  if (!eventType) return { ok: false, error: "missing_eventType" };
  if (!data) return { ok: false, error: "missing_data" };
  return {
    ok: true,
    body: {
      eventType,
      createdAt,
      data: data as TossWebhookBody["data"],
    },
  };
}

export type DoubleCheckResult =
  | { ok: true; payment: TossPaymentObject }
  | { ok: false; reason: "missing_payment_key" | "retrieve_failed" | "status_mismatch"; detail?: string };

/**
 * 웹훅 본문 신뢰성 검증: paymentKey로 토스 API에 다시 조회해서 status 일치 확인.
 */
export async function verifyTossWebhookByRetrieve(body: TossWebhookBody): Promise<DoubleCheckResult> {
  const key = body.data.paymentKey;
  if (!key || typeof key !== "string") return { ok: false, reason: "missing_payment_key" };
  const r = await retrieveTossPayment(key);
  if (!r.ok) {
    return { ok: false, reason: "retrieve_failed", detail: `${r.error.code}: ${r.error.message}` };
  }
  // 웹훅 body가 status를 포함하면 토스 실제 상태와 비교 (mismatch 시 공격 의심).
  const claimedStatus = typeof body.data.status === "string" ? body.data.status : null;
  if (claimedStatus && claimedStatus !== r.data.status) {
    return { ok: false, reason: "status_mismatch", detail: `claimed=${claimedStatus} actual=${r.data.status}` };
  }
  return { ok: true, payment: r.data };
}

/**
 * 봉심 내부 outcome으로 매핑.
 * - DONE → captured
 * - CANCELED / PARTIAL_CANCELED → cancelled
 * - ABORTED / EXPIRED → failed
 * - READY / IN_PROGRESS / WAITING_FOR_DEPOSIT → authorized (미완결)
 */
export function mapTossStatusToOutcome(
  status: TossPaymentObject["status"],
): "authorized" | "captured" | "failed" | "cancelled" {
  if (status === "DONE") return "captured";
  if (status === "CANCELED" || status === "PARTIAL_CANCELED") return "cancelled";
  if (status === "ABORTED" || status === "EXPIRED") return "failed";
  return "authorized";
}
