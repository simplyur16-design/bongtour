/**
 * Simplyur — Eximbay 인증 후 승인 (PAYMENT_PA).
 * REGRESSION-FREEZE[simplyur-eximbay-payer-auth-pa]: POST /v1/payments/confirm — manifest
 * @see https://developer.eximbay.com/eximbay/api_list/reference.html
 */
import {
  buildEximbayBasicAuthHeader,
  resolveEximbayEnv,
} from "@/lib/simplyur/payments/eximbay-env";

export type EximbayConfirmPaBody = {
  transaction_type: "PAYMENT_PA" | "AUTHORIZE_PA";
  mid: string;
  payment: {
    order_id: string;
    currency: "USD";
    amount: string;
    payer_auth_id: string;
    lang: string;
  };
};

export type CallEximbayConfirmPaResult =
  | {
      ok: true;
      rescode: string;
      resmsg: string;
      transactionId: string | null;
      raw: Record<string, unknown>;
    }
  | {
      ok: false;
      reason:
        | "eximbay_env_incomplete"
        | "eximbay_confirm_http_error"
        | "eximbay_confirm_failed"
        | "eximbay_confirm_missing_payer_auth";
      status?: number;
      rescode?: string;
      resmsg?: string;
      missing?: string[];
      detail?: string;
    };

export function buildEximbayConfirmPaBody(input: {
  mid: string;
  orderId: string;
  amountUsd: string;
  payerAuthId: string;
  lang: string;
  transactionType?: "PAYMENT_PA" | "AUTHORIZE_PA";
}): EximbayConfirmPaBody {
  return {
    transaction_type: input.transactionType ?? "PAYMENT_PA",
    mid: input.mid,
    payment: {
      order_id: input.orderId.slice(0, 50),
      currency: "USD",
      amount: input.amountUsd,
      payer_auth_id: input.payerAuthId.trim(),
      lang: input.lang || "EN",
    },
  };
}

export async function callEximbayPaymentsConfirmPa(
  body: EximbayConfirmPaBody,
  fetchImpl: typeof fetch = fetch,
): Promise<CallEximbayConfirmPaResult> {
  const payerAuthId = body.payment.payer_auth_id.trim();
  if (!payerAuthId) {
    return { ok: false, reason: "eximbay_confirm_missing_payer_auth" };
  }

  const resolved = resolveEximbayEnv();
  if (!resolved.ok) {
    return { ok: false, reason: "eximbay_env_incomplete", missing: resolved.missing };
  }
  const { env } = resolved;
  const url = `${env.apiOrigin}/v1/payments/confirm`;

  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: buildEximbayBasicAuthHeader(env.apiKey),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ ...body, mid: env.mid }),
    });
  } catch (e) {
    return {
      ok: false,
      reason: "eximbay_confirm_http_error",
      detail: e instanceof Error ? e.message.slice(0, 200) : "fetch_failed",
    };
  }

  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      reason: "eximbay_confirm_http_error",
      status: res.status,
      detail: "invalid_json",
    };
  }

  const rescode = typeof json.rescode === "string" ? json.rescode : "";
  const resmsg = typeof json.resmsg === "string" ? json.resmsg : "";
  if (!res.ok || rescode !== "0000") {
    return {
      ok: false,
      reason: "eximbay_confirm_failed",
      status: res.status,
      rescode: rescode || undefined,
      resmsg: resmsg || undefined,
    };
  }

  const transactionId =
    (typeof json.transaction_id === "string" && json.transaction_id.trim()) ||
    (typeof json.transid === "string" && json.transid.trim()) ||
    null;

  return {
    ok: true,
    rescode: rescode || "0000",
    resmsg: resmsg || "Success",
    transactionId,
    raw: json,
  };
}
