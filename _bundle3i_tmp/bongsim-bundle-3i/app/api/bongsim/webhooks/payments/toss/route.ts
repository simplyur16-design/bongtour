import { NextResponse } from "next/server";
import { getPgPool } from "@/lib/bongsim/db/pool";
import {
  parseTossWebhookBody,
  verifyTossWebhookByRetrieve,
  mapTossStatusToOutcome,
} from "@/lib/bongsim/payments/toss/webhook-parser";
import { processTossPaymentOutcome } from "@/lib/bongsim/data/process-toss-payment-outcome";

/**
 * 토스 Payments 웹훅 수신 엔드포인트.
 *
 * 흐름:
 *  1. JSON 본문 파싱
 *  2. paymentKey로 토스 API 조회 (double-check — 토스가 HMAC 서명을 제공하지 않으므로)
 *  3. 조회된 payment.orderId에서 bongsim의 paymentAttemptId 역추출
 *     (orderId는 provider가 buildTossOrderId로 `{orderNumber}-{attemptIdPrefix}` 포맷 사용)
 *  4. processTossPaymentOutcome 호출
 *
 * 주의: 토스는 같은 이벤트를 재전송할 수 있다. providerEventId는 토스가 주는 값(없으면 paymentKey 기반)을
 *       사용하고, DB uniq index가 중복을 막는다.
 *
 * 보안: 웹훅 URL이 공개되어도 paymentKey로 역조회 + orderId 대조 + DB 존재 여부 확인으로
 *       가짜 요청은 DB에 영향을 주지 못한다. 추가로 IP allowlist를 두고 싶으면
 *       TOSS_WEBHOOK_ALLOWED_IPS env로 확장 가능.
 */

function errResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    { schema: "bongsim.toss.webhook.error.v1", ok: false, error: code, message },
    { status },
  );
}

async function resolvePaymentAttemptIdByOrderId(orderId: string): Promise<string | null> {
  const pool = getPgPool();
  if (!pool) return null;
  /**
   * 토스 orderId는 `{order_number}-{attempt_prefix(8)}` 포맷으로 구성된다.
   * order_number는 bongsim_order.order_number에 저장돼 있고,
   * attempt는 bongsim_payment_attempt.payment_attempt_id의 앞 8자리.
   *
   * 안전한 역추출: order_number로 order_id를 찾고, 해당 order의 attempt 중
   * provider='toss_payments' 인 것 중에서 attempt prefix가 일치하는 것을 고른다.
   */
  const lastDash = orderId.lastIndexOf("-");
  if (lastDash <= 0) return null;
  const orderNumber = orderId.slice(0, lastDash);
  const attemptPrefix = orderId.slice(lastDash + 1);
  if (orderNumber.length === 0 || attemptPrefix.length === 0) return null;

  const r = await pool.query<{ payment_attempt_id: string }>(
    `SELECT pa.payment_attempt_id
     FROM bongsim_payment_attempt pa
     JOIN bongsim_order o ON o.order_id = pa.order_id
     WHERE o.order_number = $1
       AND pa.provider = 'toss_payments'
       AND pa.payment_attempt_id::text LIKE $2
     ORDER BY pa.created_at DESC
     LIMIT 1`,
    [orderNumber, `${attemptPrefix}%`],
  );
  return r.rows[0]?.payment_attempt_id ?? null;
}

export async function POST(req: Request) {
  if (!getPgPool()) {
    return errResponse(503, "db_unconfigured", "database not configured");
  }

  // 본문 파싱
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return errResponse(400, "invalid_json", "body must be json");
  }

  const parsed = parseTossWebhookBody(raw);
  if (!parsed.ok) {
    return errResponse(400, parsed.error, "invalid toss webhook body");
  }

  // 조회 검증 (double-check)
  const verified = await verifyTossWebhookByRetrieve(parsed.body);
  if (!verified.ok) {
    // 200 swallow 정책: 공격·오배송일 수 있지만 토스에 재전송 부담을 주지 않기 위해
    // 검증 실패도 200을 반환하되, 내부 상태는 그대로 둔다. 로그는 남긴다.
    console.warn("[toss-webhook] verify failed:", verified.reason, verified.detail);
    return NextResponse.json(
      { schema: "bongsim.toss.webhook.ack.v1", ok: true, ignored: true, reason: verified.reason },
      { status: 200 },
    );
  }

  const payment = verified.payment;

  // attempt 역추출
  const paymentAttemptId = await resolvePaymentAttemptIdByOrderId(payment.orderId);
  if (!paymentAttemptId) {
    console.warn("[toss-webhook] unknown attempt for orderId:", payment.orderId);
    return NextResponse.json(
      { schema: "bongsim.toss.webhook.ack.v1", ok: true, ignored: true, reason: "unknown_attempt" },
      { status: 200 },
    );
  }

  // DB finalize
  const outcome = mapTossStatusToOutcome(payment.status);
  const result = await processTossPaymentOutcome({
    providerEventId: `webhook_${payment.paymentKey}_${parsed.body.eventType}_${parsed.body.createdAt}`,
    paymentAttemptId,
    outcome,
    amountKrw: outcome === "captured" ? payment.totalAmount : undefined,
    paymentReference: payment.paymentKey,
    rawPayload: { event: parsed.body, payment },
  });

  // 웹훅은 항상 200 swallow — 재전송 방지
  return NextResponse.json(
    {
      schema: "bongsim.toss.webhook.ack.v1",
      ok: true,
      duplicate: result.ok && result.duplicate ? true : undefined,
      db_result: result.ok ? "applied" : `failed_${result.reason}`,
    },
    { status: 200 },
  );
}

/** 토스는 webhook GET ping이 없지만, 배포 후 연결 확인용으로 허용. */
export async function GET() {
  return NextResponse.json(
    { schema: "bongsim.toss.webhook.ping.v1", ok: true },
    { status: 200 },
  );
}
