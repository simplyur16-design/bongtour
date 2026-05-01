import { NextResponse } from "next/server";
import { buildCheckoutPaymentResultRedirectUrl } from "@/lib/bongsim/checkout/payment-result-redirect";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { WELCOMEPAY_PROVIDER_ID } from "@/lib/bongsim/data/process-welcomepay-payment-outcome";
import {
  generateMKey,
  generateMobileSignature,
  generateMobileWelpayTimestamp,
  generatePcStdPaySignature,
  generateTimestamp,
  welcomepayMobileWelpaySubmitUrl,
  welcomepayStdPayScriptUrl,
} from "@/lib/bongsim/welcomepay";

export const dynamic = "force-dynamic";

function requestOrigin(req: Request): string {
  const u = new URL(req.url);
  const protoRaw = req.headers.get("x-forwarded-proto") ?? u.protocol.replace(":", "");
  const proto = protoRaw.split(",")[0]?.trim() || "https";
  const hostRaw = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? u.host;
  const host = hostRaw.split(",")[0]?.trim() || u.host;
  return `${proto}://${host}`;
}

type PrepareBody = {
  orderId?: unknown;
  orderNumber?: unknown;
  amount?: unknown;
  orderName?: unknown;
  customerEmail?: unknown;
  paymentAttemptId?: unknown;
};

export async function POST(req: Request) {
  const mid = (process.env.WELCOMEPAY_MID ?? "").trim();
  const signKey = (process.env.WELCOMEPAY_SIGN_KEY ?? "").trim();
  if (!mid || !signKey) {
    return NextResponse.json({ ok: false, error: "welcomepay_env_incomplete" }, { status: 503 });
  }
  if (!getPgPool()) {
    return NextResponse.json({ ok: false, error: "db_unconfigured" }, { status: 503 });
  }

  let body: PrepareBody;
  try {
    body = (await req.json()) as PrepareBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  const orderNumber = typeof body.orderNumber === "string" ? body.orderNumber.trim() : "";
  const orderName = typeof body.orderName === "string" ? body.orderName.trim() : "";
  const customerEmail = typeof body.customerEmail === "string" ? body.customerEmail.trim() : "";
  const paymentAttemptId = typeof body.paymentAttemptId === "string" ? body.paymentAttemptId.trim() : "";
  const amountRaw = body.amount;
  const amount =
    typeof amountRaw === "number"
      ? Math.trunc(amountRaw)
      : typeof amountRaw === "string"
        ? Number.parseInt(amountRaw, 10)
        : NaN;

  if (!orderId || !orderNumber || !orderName || !customerEmail || !paymentAttemptId) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: "invalid_amount" }, { status: 400 });
  }

  const pool = getPgPool()!;
  const client = await pool.connect();
  try {
    const o = await client.query<{ buyer_email: string; grand_total_krw: string; status: string }>(
      `SELECT buyer_email, grand_total_krw, status FROM bongsim_order WHERE order_id = $1::uuid LIMIT 1`,
      [orderId],
    );
    const order = o.rows[0];
    if (!order || order.status !== "awaiting_payment") {
      return NextResponse.json({ ok: false, error: "order_not_payable" }, { status: 400 });
    }
    const grand = Number.parseInt(order.grand_total_krw, 10);
    if (!Number.isFinite(grand) || grand !== amount) {
      return NextResponse.json({ ok: false, error: "amount_mismatch" }, { status: 400 });
    }
    if (order.buyer_email.trim().toLowerCase() !== customerEmail.trim().toLowerCase()) {
      return NextResponse.json({ ok: false, error: "email_mismatch" }, { status: 400 });
    }

    const a = await client.query<{ provider: string; provider_session_id: string | null }>(
      `SELECT provider, provider_session_id FROM bongsim_payment_attempt WHERE payment_attempt_id = $1::uuid LIMIT 1`,
      [paymentAttemptId],
    );
    const att = a.rows[0];
    if (!att || att.provider !== WELCOMEPAY_PROVIDER_ID || att.provider_session_id !== orderNumber) {
      return NextResponse.json({ ok: false, error: "invalid_payment_attempt" }, { status: 400 });
    }
  } finally {
    client.release();
  }

  const origin = requestOrigin(req);
  const returnUrl = `${origin}/api/bongsim/checkout/welcomepay-return`;
  const closeUrl = buildCheckoutPaymentResultRedirectUrl(origin, { status: "cancel", orderId });
  const popupUrl = closeUrl;
  const pNextUrl = `${origin}/api/bongsim/checkout/welcomepay-mobile-next`;

  const timestamp = generateTimestamp();
  const mKey = generateMKey(signKey);
  const price = String(amount);
  const signature = generatePcStdPaySignature({ mKey, oid: orderNumber, price, timestamp });

  const mobilePTimestamp = generateMobileWelpayTimestamp();
  const mobilePChkfake = generateMobileSignature({
    mKey,
    pAmt: price,
    pOid: orderNumber,
    pTimestamp: mobilePTimestamp,
  });
  const buyerShort =
    customerEmail.includes("@") && customerEmail.length > 1
      ? customerEmail.split("@")[0]!.slice(0, 30)
      : customerEmail.slice(0, 30) || "고객";
  const pGoods = orderName.length > 80 ? orderName.slice(0, 80) : orderName;

  return NextResponse.json({
    ok: true,
    mid,
    orderNumber,
    price,
    timestamp,
    signature,
    mKey,
    returnUrl,
    closeUrl,
    popupUrl,
    pcStdPayScriptUrl: welcomepayStdPayScriptUrl(),
    mobile: {
      submitUrl: welcomepayMobileWelpaySubmitUrl(),
      pNextUrl,
      pMid: mid,
      pOid: orderNumber,
      pAmt: price,
      pTimestamp: mobilePTimestamp,
      pChkfake: mobilePChkfake,
      pGoods,
      pUnam: buyerShort,
      pEmail: customerEmail,
      pMobile: "01000000000",
      pIniPayment: "CARD",
    },
  });
}
