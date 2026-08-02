import { NextResponse } from "next/server";
import { processWelcomepayPaymentOutcome, WELCOMEPAY_PROVIDER_ID } from "@/lib/bongsim/data/process-welcomepay-payment-outcome";
import { getPgPool } from "@/lib/bongsim/db/pool";
// REGRESSION-FREEZE[bongsim-request-path-no-pg-probe]: no request-path TLS probe — manifest
import { readWelcomepayCallbackFromRequest } from "@/lib/bongsim/welcomepay-callback-parse";
import {
  isVbankDepositNoti,
  pickVbankNotiAmountKrw,
  pickVbankNotiOid,
  pickVbankNotiTid,
  vbankNotiProviderEventId,
} from "@/lib/bongsim/welcomepay-vbank-noti";

export const dynamic = "force-dynamic";

/**
 * 가상계좌 입금통보 `P_NOTI_URL` — PG가 입금 완료 시 서버로 POST.
 * 성공 시 본문 `OK` 반환(가이드 요구).
 */
async function handleVbankNoti(req: Request): Promise<NextResponse> {
  if (!getPgPool()) {
    return new NextResponse("db_unconfigured", { status: 503 });
  }

  const incoming = await readWelcomepayCallbackFromRequest(req);
  if (!isVbankDepositNoti(incoming)) {
    return new NextResponse("IGNORED", { status: 200 });
  }

  const oid = pickVbankNotiOid(incoming);
  if (!oid) {
    console.warn("[welcomepay-vbank-noti] missing_oid", { keys: Object.keys(incoming) });
    return new NextResponse("MISSING_OID", { status: 400 });
  }

  const pool = getPgPool()!;
  const c = await pool.connect();
  let paymentAttemptId = "";
  let grandTotalKrw = 0;
  try {
    const r = await c.query<{
      payment_attempt_id: string;
      grand_total_krw: string;
    }>(
      `SELECT pa.payment_attempt_id, o.grand_total_krw
       FROM bongsim_payment_attempt pa
       JOIN bongsim_order o ON o.order_id = pa.order_id
       WHERE pa.provider = $1 AND pa.provider_session_id = $2
       LIMIT 1`,
      [WELCOMEPAY_PROVIDER_ID, oid],
    );
    const row = r.rows[0];
    if (!row) {
      console.warn("[welcomepay-vbank-noti] unknown_payment_attempt", { oid });
      return new NextResponse("UNKNOWN_OID", { status: 400 });
    }
    paymentAttemptId = row.payment_attempt_id;
    grandTotalKrw = Number.parseInt(row.grand_total_krw, 10);
  } finally {
    c.release();
  }

  const amt = pickVbankNotiAmountKrw(incoming);
  if (
    amt != null &&
    Number.isFinite(grandTotalKrw) &&
    grandTotalKrw > 0 &&
    amt !== grandTotalKrw
  ) {
    console.warn("[welcomepay-vbank-noti] amount_mismatch", { oid, amt, grandTotalKrw });
    return new NextResponse("AMOUNT_MISMATCH", { status: 400 });
  }

  const providerEventId = vbankNotiProviderEventId(incoming);
  const amountForCapture =
    amt != null && Number.isFinite(amt) && amt > 0 ? amt : Number.isFinite(grandTotalKrw) ? grandTotalKrw : undefined;

  const fin = await processWelcomepayPaymentOutcome({
    providerEventId,
    paymentAttemptId,
    outcome: "captured",
    amountKrw: amountForCapture,
    paymentReference: pickVbankNotiTid(incoming) || pickVbankNotiOid(incoming),
    rawPayload: incoming,
  });

  if (!fin.ok) {
    console.error("[welcomepay-vbank-noti] process_failed", { oid, reason: fin.reason });
    return new NextResponse("PROCESS_FAILED", { status: 500 });
  }

  return new NextResponse("OK", { status: 200 });
}

export async function GET(req: Request) {
  return handleVbankNoti(req);
}

export async function POST(req: Request) {
  return handleVbankNoti(req);
}
