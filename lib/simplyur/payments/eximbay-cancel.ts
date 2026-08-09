/**
 * Simplyur — Eximbay full payment cancel.
 * REGRESSION-FREEZE[simplyur-eximbay-refund]: POST /v1/payments/{transaction_id}/cancel — manifest
 * @see https://developer.eximbay.com/eximbay/api_list/reference.html
 */
import {
  buildEximbayBasicAuthHeader,
  resolveEximbayEnv,
} from "@/lib/simplyur/payments/eximbay-env";

export type EximbayCancelBody = {
  mid: string;
  refund: {
    refund_type: "F";
    refund_amount: string;
    refund_id: string;
    reason: string;
  };
  payment: {
    order_id: string;
    currency: "USD";
    amount: string;
    balance: string;
    lang: string;
  };
};

export type CallEximbayCancelResult =
  | {
      ok: true;
      rescode: string;
      resmsg: string;
      refundTransactionId: string | null;
      raw: Record<string, unknown>;
    }
  | {
      ok: false;
      reason: "eximbay_env_incomplete" | "eximbay_cancel_http_error" | "eximbay_cancel_failed";
      status?: number;
      rescode?: string;
      resmsg?: string;
      missing?: string[];
      detail?: string;
    };

export function buildEximbayCancelBody(input: {
  mid: string;
  transactionOrderId: string;
  amountUsd: string;
  refundId: string;
  reason: string;
  lang?: string;
}): EximbayCancelBody {
  const amount = input.amountUsd.trim();
  return {
    mid: input.mid,
    refund: {
      refund_type: "F",
      refund_amount: amount,
      refund_id: input.refundId.slice(0, 30),
      reason: (input.reason.trim() || "Customer unused eSIM cancel").slice(0, 200),
    },
    payment: {
      order_id: input.transactionOrderId.slice(0, 50),
      currency: "USD",
      amount,
      balance: amount,
      lang: input.lang?.trim() || "EN",
    },
  };
}

export async function callEximbayPaymentsCancel(
  transactionId: string,
  body: EximbayCancelBody,
  fetchImpl: typeof fetch = fetch,
): Promise<CallEximbayCancelResult> {
  const tx = transactionId.trim();
  if (!tx) {
    return { ok: false, reason: "eximbay_cancel_failed", detail: "missing_transaction_id" };
  }

  const resolved = resolveEximbayEnv();
  if (!resolved.ok) {
    return { ok: false, reason: "eximbay_env_incomplete", missing: resolved.missing };
  }
  const { env } = resolved;
  const url = `${env.apiOrigin}/v1/payments/${encodeURIComponent(tx)}/cancel`;

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
      reason: "eximbay_cancel_http_error",
      detail: e instanceof Error ? e.message.slice(0, 200) : "fetch_failed",
    };
  }

  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      reason: "eximbay_cancel_http_error",
      status: res.status,
      detail: "invalid_json",
    };
  }

  const rescode = typeof json.rescode === "string" ? json.rescode : "";
  const resmsg = typeof json.resmsg === "string" ? json.resmsg : "";
  if (!res.ok || rescode !== "0000") {
    return {
      ok: false,
      reason: "eximbay_cancel_failed",
      status: res.status,
      rescode: rescode || undefined,
      resmsg: resmsg || undefined,
    };
  }

  const refundObj =
    json.refund && typeof json.refund === "object"
      ? (json.refund as Record<string, unknown>)
      : null;
  const refundTransactionId =
    (typeof refundObj?.refund_transaction_id === "string" &&
      refundObj.refund_transaction_id.trim()) ||
    (typeof json.refund_transaction_id === "string" && json.refund_transaction_id.trim()) ||
    null;

  return {
    ok: true,
    rescode: rescode || "0000",
    resmsg: resmsg || "Success",
    refundTransactionId,
    raw: json,
  };
}
