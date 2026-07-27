import { NextResponse } from "next/server";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { buildCheckoutPaymentResultRedirectUrl } from "@/lib/bongsim/checkout/payment-result-redirect";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { WELCOMEPAY_PROVIDER_ID } from "@/lib/bongsim/data/process-welcomepay-payment-outcome";
import {
  buildWelcomepayPgGoodsName,
} from "@/lib/bongsim/welcomepay-payment-methods";
import {
  listWelcomepayAllCheckoutMethodOptions,
  resolveWelcomepayCheckoutMethodId,
  type WelcomepayCheckoutMethodId,
} from "@/lib/bongsim/welcomepay-checkout-options";
import {
  resolveWelcomepayMobileCharsetMode,
  welcomepayMobileFormCharsetFields,
} from "@/lib/bongsim/welcomepay-pg-text-decode";
import {
  generateMKey,
  generateMobileWelpayPChkfake,
  generateMobileWelpayPSignature,
  generateMobileWelpayTimestamp,
  generatePcStdPaySignature,
  resolveWelcomepayMobileUseAmtHash,
  generateTimestamp,
  resolveWelcomepayEnv,
  resolveWelcomepayMobileHashKey,
  welcomepayCheckoutCallbackOrigin,
  welcomepayMobileNextCallbackUrlRegistered,
  welcomepayStdPayScriptUrl,
  welcomepayVbankNotiCallbackUrlRegistered,
} from "@/lib/bongsim/welcomepay";
import { welcomepayMobileOidCookieSetHeader } from "@/lib/bongsim/welcomepay-mobile-oid-cookie";

export const dynamic = "force-dynamic";

type PrepareBody = {
  orderId?: unknown;
  orderNumber?: unknown;
  amount?: unknown;
  orderName?: unknown;
  customerEmail?: unknown;
  paymentAttemptId?: unknown;
  paymentMethod?: unknown;
};

type PrepareMethodPayload = {
  id: WelcomepayCheckoutMethodId;
  label: string;
  mobile: {
    submitUrl: string;
    pIniPayment: string;
    pReserved: string;
    requiresNotiUrl: boolean;
    requiresHppMethod: boolean;
  };
  pc: {
    goPayMethod: string;
    acceptMethod?: string;
  };
};

export async function POST(req: Request) {
  const mid = (process.env.WELCOMEPAY_MID ?? "").trim();
  const signKey = (process.env.WELCOMEPAY_SIGN_KEY ?? "").trim();
  const mobileHashKey = resolveWelcomepayMobileHashKey();
  if (!mid || !signKey || !mobileHashKey) {
    return jsonWithLeakGuard({ ok: false, error: "welcomepay_env_incomplete" }, "bongsim.checkout.welcomepay-prepare", {
      status: 503,
    });
  }
  const welcomepayEnvRaw = (process.env.WELCOMEPAY_ENV ?? "").trim().toLowerCase();
  if (process.env.NODE_ENV === "production" && welcomepayEnvRaw === "test") {
    console.error(
      "[welcomepay-prepare] NODE_ENV=production but WELCOMEPAY_ENV=test — iPhone/Android가 tmobile(테스트 PG)로 나갑니다",
    );
  }
  if (!getPgPool()) {
    return jsonWithLeakGuard({ ok: false, error: "db_unconfigured" }, "bongsim.checkout.welcomepay-prepare", { status: 503 });
  }

  let body: PrepareBody;
  try {
    body = (await req.json()) as PrepareBody;
  } catch {
    return jsonWithLeakGuard({ ok: false, error: "invalid_json" }, "bongsim.checkout.welcomepay-prepare", { status: 400 });
  }

  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  const orderNumber = typeof body.orderNumber === "string" ? body.orderNumber.trim() : "";
  const customerEmail = typeof body.customerEmail === "string" ? body.customerEmail.trim() : "";
  const paymentAttemptId = typeof body.paymentAttemptId === "string" ? body.paymentAttemptId.trim() : "";
  const amountRaw = body.amount;
  const amount =
    typeof amountRaw === "number"
      ? Math.trunc(amountRaw)
      : typeof amountRaw === "string"
        ? Number.parseInt(amountRaw, 10)
        : NaN;

  if (!orderId || !orderNumber || !customerEmail || !paymentAttemptId) {
    return jsonWithLeakGuard({ ok: false, error: "missing_fields" }, "bongsim.checkout.welcomepay-prepare", { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return jsonWithLeakGuard({ ok: false, error: "invalid_amount" }, "bongsim.checkout.welcomepay-prepare", { status: 400 });
  }

  const pool = getPgPool()!;
  const client = await pool.connect();
  let bongsimOrderNumber = "";
  let pMobile = "01000000000";
  try {
    const o = await client.query<{
      buyer_email: string;
      buyer_tel: string | null;
      grand_total_krw: string;
      status: string;
      order_number: string;
      consents: unknown;
    }>(
      `SELECT buyer_email, buyer_tel, grand_total_krw, status, order_number, consents
       FROM bongsim_order WHERE order_id = $1::uuid LIMIT 1`,
      [orderId],
    );
    const order = o.rows[0];
    if (!order || order.status !== "awaiting_payment") {
      return jsonWithLeakGuard({ ok: false, error: "order_not_payable" }, "bongsim.checkout.welcomepay-prepare", {
        status: 400,
      });
    }
    const grand = Number.parseInt(order.grand_total_krw, 10);
    if (!Number.isFinite(grand) || grand !== amount) {
      return jsonWithLeakGuard({ ok: false, error: "amount_mismatch" }, "bongsim.checkout.welcomepay-prepare", { status: 400 });
    }
    if (order.buyer_email.trim().toLowerCase() !== customerEmail.trim().toLowerCase()) {
      return jsonWithLeakGuard({ ok: false, error: "email_mismatch" }, "bongsim.checkout.welcomepay-prepare", { status: 400 });
    }

    const a = await client.query<{ provider: string; provider_session_id: string | null }>(
      `SELECT provider, provider_session_id FROM bongsim_payment_attempt WHERE payment_attempt_id = $1::uuid LIMIT 1`,
      [paymentAttemptId],
    );
    const att = a.rows[0];
    if (!att || att.provider !== WELCOMEPAY_PROVIDER_ID || att.provider_session_id !== orderNumber) {
      return jsonWithLeakGuard({ ok: false, error: "invalid_payment_attempt" }, "bongsim.checkout.welcomepay-prepare", {
        status: 400,
      });
    }
    bongsimOrderNumber = order.order_number;
    const fromCol = (order.buyer_tel ?? "").replace(/\D/g, "");
    if (fromCol.length >= 10) {
      pMobile = fromCol;
    } else if (order.consents && typeof order.consents === "object") {
      const c = order.consents as Record<string, unknown>;
      const fromC = String(c.buyer_phone ?? "").replace(/\D/g, "");
      if (fromC.length >= 10) pMobile = fromC;
    }
  } finally {
    client.release();
  }

  const origin = welcomepayCheckoutCallbackOrigin();
  const returnUrl = `${origin}/api/bongsim/checkout/welcomepay-return`;
  const closeUrl = buildCheckoutPaymentResultRedirectUrl(origin, {
    status: "cancel",
    orderId,
    orderNumber: bongsimOrderNumber,
  });
  const popupUrl = closeUrl;
  // 폼 P_NEXT_URL은 가맹점 등록 URL과 바이트 단위 동일해야 함(쿼리 붙이면 PG가 01로 거절하는 경우 있음).
  const pNextUrl = welcomepayMobileNextCallbackUrlRegistered();

  const timestamp = generateTimestamp();
  const mKey = generateMKey(signKey);
  const price = String(amount);
  const signature = generatePcStdPaySignature({ mKey, oid: orderNumber, price, timestamp });

  const mobilePTimestamp = generateMobileWelpayTimestamp();
  const mobileUseAmtHash = resolveWelcomepayMobileUseAmtHash();
  const mobilePSignature = generateMobileWelpayPSignature({
    mKey,
    pAmt: price,
    pOid: orderNumber,
    pTimestamp: mobilePTimestamp,
  });
  const mobilePChkfake = mobileUseAmtHash
    ? generateMobileWelpayPChkfake({
        pAmt: price,
        pOid: orderNumber,
        pTimestamp: mobilePTimestamp,
        hashKey: mobileHashKey,
      })
    : "";
  const buyerShort =
    customerEmail.includes("@") && customerEmail.length > 1
      ? customerEmail.split("@")[0]!.slice(0, 30)
      : customerEmail.slice(0, 30) || "고객";
  const pGoods = buildWelcomepayPgGoodsName(bongsimOrderNumber);
  const paymentMethod = resolveWelcomepayCheckoutMethodId(body.paymentMethod);
  const pNotiUrl = welcomepayVbankNotiCallbackUrlRegistered();

  const mobileCharset = resolveWelcomepayMobileCharsetMode();
  const mobileCharsetFields = welcomepayMobileFormCharsetFields(mobileCharset);

  const methods: PrepareMethodPayload[] = listWelcomepayAllCheckoutMethodOptions(mobileUseAmtHash).map((opt) => ({
    id: opt.id,
    label: opt.label,
    mobile: {
      submitUrl: opt.mobile.submitUrl,
      pIniPayment: opt.mobile.pIniPayment,
      pReserved: opt.mobile.pReserved,
      requiresNotiUrl: opt.mobile.requiresNotiUrl,
      requiresHppMethod: opt.mobile.requiresHppMethod,
    },
    pc: {
      goPayMethod: opt.pc.goPayMethod,
      acceptMethod: opt.pc.acceptMethod,
    },
  }));

  const selectedMethod =
    methods.find((m) => m.id === paymentMethod) ?? methods.find((m) => m.id === "card") ?? methods[0]!;

  const res = jsonWithLeakGuard(
    {
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
      paymentMethod,
      orderName: pGoods,
      pNotiUrl,
      mobileCharset,
      mobileAcceptCharset: mobileCharsetFields.acceptCharset,
      mobilePCharset: mobileCharsetFields.pCharset,
      methods,
      mobile: {
        submitUrl: selectedMethod.mobile.submitUrl,
        pNextUrl,
        pMid: mid,
        pOid: orderNumber,
        pNoti: orderNumber,
        pAmt: price,
        pTimestamp: mobilePTimestamp,
        pSignature: mobilePSignature,
        pChkfake: mobilePChkfake,
        mobileUseAmtHash,
        pGoods,
        pUnam: buyerShort,
        pEmail: customerEmail,
        pMobile,
        pIniPayment: selectedMethod.mobile.pIniPayment,
        pReserved: selectedMethod.mobile.pReserved,
      },
      welcomepay_env: resolveWelcomepayEnv(),
    },
    "bongsim.checkout.welcomepay-prepare",
  );
  res.headers.append("Set-Cookie", welcomepayMobileOidCookieSetHeader(orderNumber));
  return res;
}
