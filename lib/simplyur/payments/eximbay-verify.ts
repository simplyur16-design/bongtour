/**
 * Simplyur — Eximbay 결제 검증 API.
 * REGRESSION-FREEZE[simplyur-eximbay-payment-prep]: POST /v1/payments/verify — manifest
 * @see https://developer.eximbay.com/eximbay/api_list/reference.html
 */
import {
  buildEximbayBasicAuthHeader,
  resolveEximbayEnv,
} from "@/lib/simplyur/payments/eximbay-env";

export type CallEximbayVerifyResult =
  | { ok: true; rescode: string; resmsg: string }
  | {
      ok: false;
      reason: "eximbay_env_incomplete" | "eximbay_verify_http_error" | "eximbay_verify_failed";
      status?: number;
      rescode?: string;
      resmsg?: string;
      missing?: string[];
      detail?: string;
    };

/**
 * status_url로 받은 쿼리스트링 전체를 `data`에 그대로 넣어 검증한다.
 * (결제 준비 시 fgkey와 응답 fgkey는 다름 — 문서 주의)
 */
export async function callEximbayPaymentsVerify(
  statusQueryString: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CallEximbayVerifyResult> {
  const data = statusQueryString.trim().replace(/^\?/, "");
  if (!data) {
    return { ok: false, reason: "eximbay_verify_failed", detail: "empty_data" };
  }

  const resolved = resolveEximbayEnv();
  if (!resolved.ok) {
    return { ok: false, reason: "eximbay_env_incomplete", missing: resolved.missing };
  }
  const { env } = resolved;
  const url = `${env.apiOrigin}/v1/payments/verify`;

  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: buildEximbayBasicAuthHeader(env.apiKey),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ data }),
    });
  } catch (e) {
    return {
      ok: false,
      reason: "eximbay_verify_http_error",
      detail: e instanceof Error ? e.message.slice(0, 200) : "fetch_failed",
    };
  }

  let json: { rescode?: string; resmsg?: string } = {};
  try {
    json = (await res.json()) as typeof json;
  } catch {
    return {
      ok: false,
      reason: "eximbay_verify_http_error",
      status: res.status,
      detail: "invalid_json",
    };
  }

  if (!res.ok || json.rescode !== "0000") {
    return {
      ok: false,
      reason: "eximbay_verify_failed",
      status: res.status,
      rescode: json.rescode,
      resmsg: json.resmsg,
    };
  }

  return {
    ok: true,
    rescode: json.rescode ?? "0000",
    resmsg: json.resmsg ?? "Success",
  };
}

/** Eximbay status_url ACK — 문서: 처리성공 rescode=0000&resmsg=Success */
export function eximbayStatusUrlAckBody(ok: boolean, message?: string): string {
  if (ok) return "rescode=0000&resmsg=Success";
  const msg = (message ?? "Fail").replace(/[&=\s]+/g, "_").slice(0, 80);
  return `rescode=XXXX&resmsg=${msg}`;
}

/** Pull order_id / transaction_id / payer_auth from Eximbay status_url querystring. */
export function parseEximbayStatusQuery(data: string): {
  orderId: string | null;
  transactionId: string | null;
  rescode: string | null;
  payerAuthId: string | null;
  transactionType: string | null;
} {
  const params = new URLSearchParams(data.trim().replace(/^\?/, ""));
  const orderId =
    params.get("order_id")?.trim() ||
    params.get("orderId")?.trim() ||
    params.get("ref")?.trim() ||
    null;
  const transactionId =
    params.get("transaction_id")?.trim() ||
    params.get("transid")?.trim() ||
    null;
  const rescode = params.get("rescode")?.trim() || null;
  const payerAuthId =
    params.get("payer_auth_id")?.trim() ||
    params.get("payerauthid")?.trim() ||
    params.get("payerAuthId")?.trim() ||
    null;
  const transactionType =
    params.get("transaction_type")?.trim() ||
    params.get("txntype")?.trim() ||
    null;
  return { orderId, transactionId, rescode, payerAuthId, transactionType };
}

/** Auth-only status — do not mark order paid yet. */
export function isEximbayPayerAuthStatus(parsed: {
  payerAuthId: string | null;
  transactionType: string | null;
  transactionId: string | null;
  rescode: string | null;
}): boolean {
  if (parsed.rescode && parsed.rescode !== "0000") return false;
  if (!parsed.payerAuthId) return false;
  const txn = (parsed.transactionType ?? "").toUpperCase();
  if (txn === "PAYER_AUTH") return true;
  // Auth callback often omits txntype; full payment callbacks include transaction_id.
  if (!txn && !parsed.transactionId) return true;
  return false;
}
