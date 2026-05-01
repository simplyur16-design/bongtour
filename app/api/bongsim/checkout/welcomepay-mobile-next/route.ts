import { NextResponse } from "next/server";
import { bongsimPath } from "@/lib/bongsim/constants";
import { buildCheckoutPaymentResultRedirectUrl } from "@/lib/bongsim/checkout/payment-result-redirect";
import { processWelcomepayPaymentOutcome, WELCOMEPAY_PROVIDER_ID } from "@/lib/bongsim/data/process-welcomepay-payment-outcome";
import { getPgPool } from "@/lib/bongsim/db/pool";
import {
  parseWelcomepayPayload,
  pickAmountKrw,
  pickOid,
  pickTid,
  resultCodeOf,
} from "@/lib/bongsim/welcomepay-callback-parse";
import { isPaywelcomeHttpsUrl, welcomepayPayAuthUrl } from "@/lib/bongsim/welcomepay";

export const dynamic = "force-dynamic";

/**
 * 모바일 welpay `P_NEXT_URL` — PG가 인증 후 POST 하는 엔드포인트.
 * 본문을 `P_REQ_URL`(있으면) 또는 PC와 동일 `payAuth`로 전달한 뒤 승인 결과로 주문을 확정한다.
 */

function requestOrigin(req: Request): string {
  const u = new URL(req.url);
  const protoRaw = req.headers.get("x-forwarded-proto") ?? u.protocol.replace(":", "");
  const proto = protoRaw.split(",")[0]?.trim() || "https";
  const hostRaw = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? u.host;
  const host = hostRaw.split(",")[0]?.trim() || u.host;
  return `${proto}://${host}`;
}

export async function POST(req: Request) {
  const origin = requestOrigin(req);
  const fail = (orderId: string, reason: string) =>
    NextResponse.redirect(
      buildCheckoutPaymentResultRedirectUrl(origin, { status: "fail", orderId, message: reason }),
      303,
    );

  if (!getPgPool()) {
    return new NextResponse("db_unconfigured", { status: 503 });
  }

  const rawBody = await req.text();
  const incoming = parseWelcomepayPayload(rawBody);
  const oid = pickOid(incoming);
  if (!oid) {
    return new NextResponse("missing_oid", { status: 400 });
  }

  const pool = getPgPool()!;
  const c = await pool.connect();
  let paymentAttemptId = "";
  let orderId = "";
  let grandTotalKrw = 0;
  try {
    const r = await c.query<{ payment_attempt_id: string; order_id: string; grand_total_krw: string }>(
      `SELECT pa.payment_attempt_id, pa.order_id, o.grand_total_krw
       FROM bongsim_payment_attempt pa
       JOIN bongsim_order o ON o.order_id = pa.order_id
       WHERE pa.provider = $1 AND pa.provider_session_id = $2
       LIMIT 1`,
      [WELCOMEPAY_PROVIDER_ID, oid],
    );
    const row = r.rows[0];
    if (!row) {
      return new NextResponse("unknown_payment_attempt", { status: 400 });
    }
    paymentAttemptId = row.payment_attempt_id;
    orderId = row.order_id;
    grandTotalKrw = Number.parseInt(row.grand_total_krw, 10);
  } finally {
    c.release();
  }

  const preq = incoming.P_REQ_URL?.trim() ?? incoming.p_req_url?.trim();
  const target =
    preq && (isPaywelcomeHttpsUrl(preq) || preq.startsWith("http://localhost")) ? preq : welcomepayPayAuthUrl();

  let authText: string;
  try {
    const authRes = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Accept: "application/json, text/plain, */*",
      },
      body: rawBody,
    });
    authText = await authRes.text();
  } catch (e) {
    return fail(orderId, e instanceof Error ? e.message : "approval_fetch_failed");
  }

  const authMap = parseWelcomepayPayload(authText);
  const merged: Record<string, string> = { ...incoming, ...authMap };
  const rc = resultCodeOf(merged);
  if (rc !== "0000") {
    const msg = merged.resultMsg ?? merged.ResultMsg ?? `resultCode=${rc || "unknown"}`;
    return fail(orderId, msg);
  }

  const tid = pickTid(merged);
  const amt = pickAmountKrw(merged);
  const providerEventId = `welcomepay_mobile_${tid}`;
  const amountForCapture =
    amt != null && Number.isFinite(amt) && amt > 0 ? amt : Number.isFinite(grandTotalKrw) ? grandTotalKrw : undefined;

  const fin = await processWelcomepayPaymentOutcome({
    providerEventId,
    paymentAttemptId,
    outcome: "captured",
    amountKrw: amountForCapture,
    paymentReference: tid,
    rawPayload: merged,
  });

  if (!fin.ok) {
    return fail(orderId, fin.reason);
  }

  const okUrl = `${origin}${bongsimPath(`/checkout/return/success?orderId=${encodeURIComponent(orderId)}`)}`;
  return NextResponse.redirect(okUrl, 303);
}
