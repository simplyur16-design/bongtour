import { NextResponse } from "next/server";
import { confirmTossPayment } from "@/lib/bongsim/payments/toss/client";
import { processTossPaymentOutcome } from "@/lib/bongsim/data/process-toss-payment-outcome";
import { getPgPool } from "@/lib/bongsim/db/pool";

/**
 * 토스 결제 승인 엔드포인트.
 *
 * 프론트 successUrl 콜백에서 paymentKey·orderId·amount·paymentAttemptId를 POST로 넘겨준다.
 * 서버는:
 *   1. 토스 /v1/payments/confirm 호출 (실 승인)
 *   2. 응답 amount·orderId 검증
 *   3. DB finalize (processTossPaymentOutcome)
 *   4. 결과 반환 → 프론트가 success/fail 페이지로 분기
 *
 * 중요: 결제 금액 검증은 **서버가 DB에서 조회한 grand_total**과 토스 응답을
 * processTossPaymentOutcome 내부에서 재검증한다. 클라이언트가 넘긴 amount는 최초 확인용.
 */

type ConfirmBody = {
  paymentKey?: unknown;
  orderId?: unknown;
  amount?: unknown;
  paymentAttemptId?: unknown;
};

function errResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    { schema: "bongsim.toss.confirm.error.v1", ok: false, error: code, message },
    { status },
  );
}

export async function POST(req: Request) {
  if (!getPgPool()) {
    return errResponse(503, "db_unconfigured", "database not configured");
  }

  let parsed: ConfirmBody;
  try {
    parsed = (await req.json()) as ConfirmBody;
  } catch {
    return errResponse(400, "invalid_json", "request body must be json");
  }

  const paymentKey = typeof parsed.paymentKey === "string" ? parsed.paymentKey.trim() : "";
  const orderId = typeof parsed.orderId === "string" ? parsed.orderId.trim() : "";
  const amountRaw = parsed.amount;
  const paymentAttemptId = typeof parsed.paymentAttemptId === "string" ? parsed.paymentAttemptId.trim() : "";

  const amount =
    typeof amountRaw === "number"
      ? Math.trunc(amountRaw)
      : typeof amountRaw === "string"
      ? Number.parseInt(amountRaw, 10)
      : NaN;

  if (!paymentKey) return errResponse(400, "missing_paymentKey", "paymentKey required");
  if (!orderId) return errResponse(400, "missing_orderId", "orderId required");
  if (!paymentAttemptId) return errResponse(400, "missing_paymentAttemptId", "paymentAttemptId required");
  if (!Number.isFinite(amount) || amount <= 0) return errResponse(400, "invalid_amount", "amount must be positive");

  /* 1) 토스 실 승인 */
  const confirmed = await confirmTossPayment({
    paymentKey,
    orderId,
    amount,
    idempotencyKey: `bongsim_confirm_${paymentAttemptId}`,
  });

  if (!confirmed.ok) {
    return NextResponse.json(
      {
        schema: "bongsim.toss.confirm.error.v1",
        ok: false,
        error: "toss_confirm_failed",
        toss_code: confirmed.error.code,
        message: confirmed.error.message,
      },
      { status: confirmed.status || 502 },
    );
  }

  const payment = confirmed.data;

  /* 2) 응답 무결성 체크 (toss가 응답한 orderId와 클라이언트가 보낸 orderId 일치) */
  if (payment.orderId !== orderId) {
    return errResponse(400, "orderId_mismatch", `toss returned orderId=${payment.orderId}`);
  }
  if (payment.totalAmount !== amount) {
    return errResponse(400, "amount_mismatch", `toss returned amount=${payment.totalAmount}`);
  }

  /* 3) DB finalize */
  const result = await processTossPaymentOutcome({
    providerEventId: `confirm_${paymentKey}`,
    paymentAttemptId,
    outcome: payment.status === "DONE" ? "captured" : "authorized",
    amountKrw: payment.totalAmount,
    paymentReference: paymentKey,
    rawPayload: payment,
  });

  if (!result.ok) {
    // 토스 쪽은 이미 승인됐는데 DB 반영 실패 — 운영자가 수동으로 맞춰야 함.
    return NextResponse.json(
      {
        schema: "bongsim.toss.confirm.error.v1",
        ok: false,
        error: "db_reconcile_failed",
        db_reason: result.reason,
        toss_payment_key: paymentKey,
        message:
          "Toss payment confirmed but DB finalize failed. Check bongsim_payment_attempt and reconcile manually.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      schema: "bongsim.toss.confirm.response.v1",
      ok: true,
      duplicate: Boolean(result.duplicate),
      paymentKey,
      orderId,
      amount: payment.totalAmount,
      status: payment.status,
      method: payment.method ?? null,
      approvedAt: payment.approvedAt,
    },
    { status: 200 },
  );
}
