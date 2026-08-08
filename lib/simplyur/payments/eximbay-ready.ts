/**
 * Simplyur — Eximbay 결제 준비 API (FGKey).
 * REGRESSION-FREEZE[simplyur-eximbay-payment-prep]: POST /v1/payments/ready — manifest
 * @see https://developer.eximbay.com/eximbay/payment_linkage/preparing-fgkey.html
 */
import {
  buildEximbayBasicAuthHeader,
  resolveEximbayEnv,
  type EximbayEnv,
} from "@/lib/simplyur/payments/eximbay-env";
import { krwOrderTotalToUsdMinor, krwOrderTotalToUsdMinorResolved } from "@/lib/simplyur/payments/portone-methods";

export type EximbayOsType = "P" | "M";
export type EximbayDisplayType = "P" | "R";
/** PAYMENT = full window; PAYER_AUTH = auth only then server /v1/payments/confirm */
export type EximbayTransactionType = "PAYMENT" | "PAYER_AUTH";

export type EximbayReadyRequestBody = {
  payment: {
    transaction_type: EximbayTransactionType;
    order_id: string;
    currency: "USD";
    amount: string;
    lang: string;
  };
  merchant: { mid: string };
  buyer: { name: string; email: string };
  url: { return_url: string; status_url: string };
  /** PC(P) vs mobile(M) payment UI — Simplyur defaults to mobile. */
  settings: {
    ostype: EximbayOsType;
    /** P=popup, R=redirect — mobile prefers redirect. */
    display_type: EximbayDisplayType;
    /** App WebView — return to simplyur:// after issuer auth. */
    call_from_app?: "Y" | "N";
    call_from_scheme?: string;
  };
};

export type EximbayRequestPayPayload = EximbayReadyRequestBody & { fgkey: string };

/** USD minor (cents) → Eximbay amount string (major). */
export function formatEximbayUsdAmountFromMinor(usdMinor: number): string {
  const n = Math.max(1, Math.trunc(usdMinor));
  const major = n / 100;
  if (Number.isInteger(major)) return String(major);
  return major.toFixed(2);
}

export function krwOrderTotalToEximbayUsdAmount(krw: number): string {
  return formatEximbayUsdAmountFromMinor(krwOrderTotalToUsdMinor(krw));
}

export async function krwOrderTotalToEximbayUsdAmountResolved(krw: number): Promise<string> {
  return formatEximbayUsdAmountFromMinor(await krwOrderTotalToUsdMinorResolved(krw));
}

export function mapSimplyurLocaleToEximbayLang(locale: string | null | undefined): string {
  const loc = (locale ?? "en").trim().toLowerCase();
  if (loc === "ja") return "JP";
  if (loc === "zh" || loc === "zh-cn") return "CN";
  if (loc === "zh-tw") return "TW";
  if (loc === "vi") return "EN";
  return "EN";
}

/** Simplyur is phone/app-first — mobile UI unless explicitly PC. */
export function resolveEximbayClientSettings(ostype: EximbayOsType = "M"): {
  ostype: EximbayOsType;
  display_type: EximbayDisplayType;
} {
  if (ostype === "P") return { ostype: "P", display_type: "P" };
  return { ostype: "M", display_type: "R" };
}

export function buildEximbayReadyRequestBody(input: {
  mid: string;
  orderId: string;
  amountUsdMinor: number;
  buyerName: string;
  buyerEmail: string;
  lang: string;
  returnUrl: string;
  statusUrl: string;
  /** Default M — mobile payment window (not PC popup). */
  ostype?: EximbayOsType;
  /** Default PAYMENT (web). Mobile app uses PAYER_AUTH + /v1/payments/confirm. */
  transactionType?: EximbayTransactionType;
  callFromApp?: boolean;
  callFromScheme?: string;
}): EximbayReadyRequestBody {
  const settings = resolveEximbayClientSettings(input.ostype ?? "M");
  const txn: EximbayTransactionType =
    input.transactionType === "PAYER_AUTH" ? "PAYER_AUTH" : "PAYMENT";
  return {
    payment: {
      transaction_type: txn,
      order_id: input.orderId.slice(0, 50),
      currency: "USD",
      amount: formatEximbayUsdAmountFromMinor(input.amountUsdMinor),
      lang: input.lang || "EN",
    },
    merchant: { mid: input.mid },
    buyer: {
      name: (input.buyerName || "guest").slice(0, 100),
      email: (input.buyerEmail || "noreply@example.com").slice(0, 100),
    },
    url: {
      return_url: input.returnUrl,
      status_url: input.statusUrl,
    },
    settings: {
      ...settings,
      ...(input.callFromApp
        ? {
            call_from_app: "Y" as const,
            call_from_scheme: (input.callFromScheme || "simplyur").slice(0, 40),
          }
        : {}),
    },
  };
}

export type CallEximbayReadyResult =
  | { ok: true; fgkey: string; requestBody: EximbayReadyRequestBody; env: EximbayEnv }
  | {
      ok: false;
      reason: "eximbay_env_incomplete" | "eximbay_ready_http_error" | "eximbay_ready_no_fgkey";
      status?: number;
      rescode?: string;
      resmsg?: string;
      missing?: string[];
      detail?: string;
    };

export async function callEximbayPaymentsReady(
  requestBody: EximbayReadyRequestBody,
  fetchImpl: typeof fetch = fetch,
): Promise<CallEximbayReadyResult> {
  const resolved = resolveEximbayEnv();
  if (!resolved.ok) {
    return { ok: false, reason: "eximbay_env_incomplete", missing: resolved.missing };
  }
  const { env } = resolved;
  const url = `${env.apiOrigin}/v1/payments/ready`;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: buildEximbayBasicAuthHeader(env.apiKey),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestBody),
    });
  } catch (e) {
    return {
      ok: false,
      reason: "eximbay_ready_http_error",
      detail: e instanceof Error ? e.message.slice(0, 200) : "fetch_failed",
    };
  }

  let json: { rescode?: string; resmsg?: string; fgkey?: string } = {};
  try {
    json = (await res.json()) as typeof json;
  } catch {
    return {
      ok: false,
      reason: "eximbay_ready_http_error",
      status: res.status,
      detail: "invalid_json",
    };
  }

  const fgkey = typeof json.fgkey === "string" ? json.fgkey.trim() : "";
  if (!res.ok || json.rescode !== "0000" || !fgkey) {
    return {
      ok: false,
      reason: fgkey ? "eximbay_ready_http_error" : "eximbay_ready_no_fgkey",
      status: res.status,
      rescode: json.rescode,
      resmsg: json.resmsg,
    };
  }

  return { ok: true, fgkey, requestBody, env };
}

/** Same params must be passed to EXIMBAY.request_pay as were used for ready. */
export function toEximbayRequestPayPayload(
  fgkey: string,
  requestBody: EximbayReadyRequestBody,
): EximbayRequestPayPayload {
  return { fgkey, ...requestBody };
}
