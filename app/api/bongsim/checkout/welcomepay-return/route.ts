import { NextResponse } from "next/server";
import { assertNoInternalMetaLeak } from "@/lib/public-response-guard";
import { bongsimPath } from "@/lib/bongsim/constants";
import { processWelcomepayPaymentOutcome, WELCOMEPAY_PROVIDER_ID } from "@/lib/bongsim/data/process-welcomepay-payment-outcome";
import { getPgPool, probePgPoolTlsOrFallback } from "@/lib/bongsim/db/pool";
import {
  isVbankIssuedApproval,
  parseWelcomepayPayload,
  pickAmountKrw,
  pickCaptureTid,
  pickOid,
  pickVbankIssueInfo,
  readWelcomepayCallbackFromRequest,
  resultCodeOf,
} from "@/lib/bongsim/welcomepay-callback-parse";
import { buildCheckoutPaymentResultRedirectUrl } from "@/lib/bongsim/checkout/payment-result-redirect";
import {
  isWelcomepayAuthSuccessCode,
  welcomepayCheckoutFailMessage,
  welcomepayPgAuthFailMessage,
} from "@/lib/bongsim/checkout/welcomepay-fail-message";
import { isPaywelcomeHttpsUrl, welcomepayPayAuthUrl } from "@/lib/bongsim/welcomepay";
import {
  buildPcPayAuthFormBody,
  pickAuthToken,
  pickMid,
  verifyWelcomepayAuthSignature,
} from "@/lib/bongsim/welcomepay-payauth";

export const dynamic = "force-dynamic";

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
  let orderId = "";
  let orderNumber = "";
  const fail = (reason: string) =>
    NextResponse.redirect(
      buildCheckoutPaymentResultRedirectUrl(origin, {
        status: "fail",
        orderId,
        orderNumber,
        message: reason,
      }),
      303,
    );

  if (!getPgPool()) {
    return new NextResponse("db_unconfigured", { status: 503 });
  }
  await probePgPoolTlsOrFallback();

  const incoming = await readWelcomepayCallbackFromRequest(req);
  const oid = pickOid(incoming);
  if (!oid) {
    console.error("[welcomepay-return] missing_oid", {
      method: req.method,
      contentType: req.headers.get("content-type"),
      keys: Object.keys(incoming),
    });
    return fail("missing_oid");
  }

  const pool = getPgPool()!;
  const c = await pool.connect();
  let paymentAttemptId = "";
  let grandTotalKrw = 0;
  try {
    const r = await c.query<{
      payment_attempt_id: string;
      order_id: string;
      grand_total_krw: string;
      order_number: string;
    }>(
      `SELECT pa.payment_attempt_id, pa.order_id, o.grand_total_krw, o.order_number
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
    orderNumber = row.order_number;
    grandTotalKrw = Number.parseInt(row.grand_total_krw, 10);
  } finally {
    c.release();
  }

  const authRc = resultCodeOf(incoming);
  if (authRc && !isWelcomepayAuthSuccessCode(authRc)) {
    const msg = welcomepayPgAuthFailMessage({
      resultCode: authRc,
      pgMessage: incoming.resultMsg ?? incoming.ResultMsg,
    });
    return fail(msg);
  }

  const authToken = pickAuthToken(incoming);
  if (!authToken) {
    return fail("missing_auth_token");
  }

  const payMid = pickMid(incoming) || (process.env.WELCOMEPAY_MID ?? "").trim();
  if (!payMid) {
    return fail("missing_mid");
  }

  const payAuthBody = buildPcPayAuthFormBody({ mid: payMid, authToken });
  const payAuthTimestamp = payAuthBody.get("timestamp") ?? "";

  const authUrl = incoming.authUrl?.trim();
  const target =
    authUrl && (isPaywelcomeHttpsUrl(authUrl) || authUrl.startsWith("http://localhost"))
      ? authUrl
      : welcomepayPayAuthUrl();

  let authText: string;
  try {
    const authRes = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Accept: "application/json, text/plain, */*",
      },
      body: payAuthBody.toString(),
    });
    authText = await authRes.text();
  } catch (e) {
    return fail(e instanceof Error ? e.message : "payauth_fetch_failed");
  }

  const authMap = parseWelcomepayPayload(authText);
  const merged: Record<string, string> = { ...incoming, ...authMap };
  const rc = resultCodeOf(merged);
  if (!isWelcomepayAuthSuccessCode(rc)) {
    const msg = merged.resultMsg ?? merged.ResultMsg ?? `resultCode=${rc || "unknown"}`;
    return fail(msg);
  }

  const authSig = (merged.authSignature ?? merged.AuthSignature ?? "").trim();
  if (authSig) {
    const moid = (merged.MOID ?? merged.moid ?? pickOid(merged)).trim();
    const totRaw = merged.TotPrice ?? merged.totPrice ?? merged.price ?? "";
    const totPrice = String(totRaw).trim() || String(grandTotalKrw);
    if (
      !verifyWelcomepayAuthSignature({
        mid: payMid,
        authTimestamp: payAuthTimestamp,
        moid,
        totPrice,
        authSignature: authSig,
      })
    ) {
      return fail("auth_signature_mismatch");
    }
  }

  const tid = pickCaptureTid(merged);
  if (!tid) return fail("missing_capture_tid");
  const amt = pickAmountKrw(merged);
  if (
    amt != null &&
    Number.isFinite(grandTotalKrw) &&
    grandTotalKrw > 0 &&
    amt !== grandTotalKrw
  ) {
    return fail("amount_mismatch");
  }
  const amountForCapture =
    amt != null && Number.isFinite(amt) && amt > 0 ? amt : Number.isFinite(grandTotalKrw) ? grandTotalKrw : undefined;

  if (isVbankIssuedApproval(merged)) {
    const vbank = pickVbankIssueInfo(merged);
    const finVbank = await processWelcomepayPaymentOutcome({
      providerEventId: `welcomepay_pc_vbank_issue_${tid}`,
      paymentAttemptId,
      outcome: "authorized",
      rawPayload: merged,
    });
    if (!finVbank.ok) {
      return fail(welcomepayCheckoutFailMessage(finVbank));
    }
    const due =
      vbank?.dueDate && vbank.dueTime
        ? `${vbank.dueDate} ${vbank.dueTime}`
        : vbank?.dueDate || "";
    return NextResponse.redirect(
      buildCheckoutPaymentResultRedirectUrl(origin, {
        status: "vbank_pending",
        orderId,
        orderNumber,
        amount: amountForCapture != null ? String(amountForCapture) : undefined,
        vbankAccount: vbank?.account,
        vbankBank: vbank?.bankName,
        vbankHolder: vbank?.holder,
        vbankDue: due || undefined,
        message: "가상계좌가 발급되었습니다. 입금 기한 내에 입금해 주세요.",
      }),
      303,
    );
  }

  const providerEventId = `welcomepay_auth_${tid}`;
  const fin = await processWelcomepayPaymentOutcome({
    providerEventId,
    paymentAttemptId,
    outcome: "captured",
    amountKrw: amountForCapture,
    paymentReference: tid,
    rawPayload: merged,
  });

  if (!fin.ok) {
    return fail(welcomepayCheckoutFailMessage(fin));
  }

  const okQ = new URLSearchParams();
  okQ.set("orderId", orderId);
  if (orderNumber.trim()) okQ.set("orderNumber", orderNumber.trim());
  const okUrl = `${origin}${bongsimPath(`/checkout/return/success?${okQ.toString()}`)}`;
  try {
    assertNoInternalMetaLeak(
      { orderId, orderNumber: orderNumber.trim() },
      "bongsim.checkout.welcomepay-return.redirect_ok",
    );
  } catch (err) {
    console.error("[leak-guard]", err);
    return fail("internal_meta_leak_blocked");
  }
  return NextResponse.redirect(okUrl, 303);
}
