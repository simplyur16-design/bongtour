import type {
  BongsimPaymentProviderAdapter,
  BongsimPaymentProviderCreateInput,
  BongsimPaymentProviderCreateResult,
} from "@/lib/bongsim/payments/provider-types";
import { bongsimPath } from "@/lib/bongsim/constants";

/**
 * Toss Payments provider.
 *
 * 세션 생성 단계에서 하는 일:
 *  1. 토스 SDK에 넘길 orderId 생성 (attempt 기반, 토스 규격 6~64자 영문/숫자/-_ 준수)
 *  2. order_name (결제창 표시용 짧은 상품명) 도출
 *  3. 프론트가 토스 결제창을 열 수 있는 페이지 경로 반환
 *
 * 실제 토스 API 호출(결제창 호출, 승인, 취소)은 각 라우트에서 처리.
 */
export class TossPaymentsProvider implements BongsimPaymentProviderAdapter {
  readonly id = "toss_payments";

  async createSession(input: BongsimPaymentProviderCreateInput): Promise<BongsimPaymentProviderCreateResult> {
    const tossOrderId = buildTossOrderId(input.order_number, input.payment_attempt_id);
    const publicRef = `toss_${input.payment_attempt_id.slice(0, 8)}`;
    const orderName = buildOrderName(input.order_number);

    const q = new URLSearchParams({
      paymentAttemptId: input.payment_attempt_id,
      orderId: input.order_id,
      ref: publicRef,
    });
    // `bongsimPath`는 봉투어 내부 prefix를 자동 적용.
    const redirectPath = `${bongsimPath("/checkout/payment/toss")}?${q.toString()}`;

    return {
      provider_session_id: tossOrderId,
      client: {
        kind: "toss_sdk",
        redirect_path: redirectPath,
        public_session_ref: publicRef,
        toss_order_id: tossOrderId,
        order_name: orderName,
        customer_email: input.buyer_email,
        amount_krw: input.amount_krw,
      },
    };
  }
}

/**
 * 토스 orderId 규격:
 * - 영문 대소문자, 숫자, 특수문자 `-`, `_`, `=` 만 허용
 * - 6~64자
 * 우리 order_number(UUID 형태)는 보통 이미 통과하지만 안전하게 필터링한다.
 */
function buildTossOrderId(orderNumber: string, attemptId: string): string {
  const suffix = attemptId.slice(0, 8);
  const raw = `${orderNumber}-${suffix}`.replace(/[^A-Za-z0-9_\-=]/g, "");
  const trimmed = raw.slice(0, 64);
  if (trimmed.length >= 6) return trimmed;
  // fallback: attempt 기반 패딩
  return `bongsim-${attemptId}`.replace(/[^A-Za-z0-9_\-=]/g, "").slice(0, 64);
}

/** 결제창에 표시되는 상품명. 100자 제한. */
function buildOrderName(orderNumber: string): string {
  const label = `Bong투어 eSIM 주문 ${orderNumber}`;
  return label.length > 100 ? label.slice(0, 100) : label;
}
