/**
 * Toss Payments server-to-server client.
 *
 * All methods use Basic auth: base64("{TOSS_SECRET_KEY}:") — no password.
 * Secret key NEVER leaves the server.
 */
import type { TossPaymentObject, TossErrorResponse } from "@/lib/bongsim/payments/toss/types";

const TOSS_API_BASE = "https://api.tosspayments.com";

function getTossSecretKey(): string | null {
  const k = process.env.TOSS_SECRET_KEY?.trim();
  return k && k.length > 0 ? k : null;
}

function buildAuthHeader(secretKey: string): string {
  const raw = `${secretKey}:`;
  const encoded = typeof Buffer !== "undefined" ? Buffer.from(raw, "utf8").toString("base64") : btoa(raw);
  return `Basic ${encoded}`;
}

export type TossCallResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: TossErrorResponse }
  | { ok: false; status: 0; error: { code: "NETWORK_ERROR" | "NO_SECRET_KEY"; message: string } };

async function doJsonFetch<T>(
  path: string,
  init: { method: "POST" | "GET"; body?: unknown; idempotencyKey?: string },
): Promise<TossCallResult<T>> {
  const secret = getTossSecretKey();
  if (!secret) {
    return { ok: false, status: 0, error: { code: "NO_SECRET_KEY", message: "TOSS_SECRET_KEY not configured" } };
  }
  const headers: Record<string, string> = {
    Authorization: buildAuthHeader(secret),
    "Content-Type": "application/json",
  };
  if (init.idempotencyKey) {
    headers["Idempotency-Key"] = init.idempotencyKey;
  }
  let res: Response;
  try {
    res = await fetch(`${TOSS_API_BASE}${path}`, {
      method: init.method,
      headers,
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed";
    return { ok: false, status: 0, error: { code: "NETWORK_ERROR", message: msg } };
  }
  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    const err = (parsed as Partial<TossErrorResponse>) ?? {};
    return {
      ok: false,
      status: res.status,
      error: {
        code: typeof err.code === "string" ? err.code : "UNKNOWN_TOSS_ERROR",
        message: typeof err.message === "string" ? err.message : `HTTP ${res.status}`,
      },
    };
  }
  return { ok: true, data: parsed as T };
}

/**
 * 결제 승인. successUrl 리다이렉트 직후 서버에서 호출.
 *
 * - `orderId`·`amount`는 클라이언트가 넘긴 값을 그대로 사용 (위변조 검증은 DB와 교차로).
 * - `idempotency_key`는 멱등 재시도 대응.
 */
export async function confirmTossPayment(params: {
  paymentKey: string;
  orderId: string;
  amount: number;
  idempotencyKey?: string;
}): Promise<TossCallResult<TossPaymentObject>> {
  return doJsonFetch<TossPaymentObject>("/v1/payments/confirm", {
    method: "POST",
    body: {
      paymentKey: params.paymentKey,
      orderId: params.orderId,
      amount: params.amount,
    },
    idempotencyKey: params.idempotencyKey,
  });
}

/**
 * 결제 취소 (전액).
 * 부분 취소가 필요해지면 `cancelAmount` 옵션 추가.
 */
export async function cancelTossPayment(params: {
  paymentKey: string;
  cancelReason: string;
  idempotencyKey?: string;
}): Promise<TossCallResult<TossPaymentObject>> {
  return doJsonFetch<TossPaymentObject>(`/v1/payments/${encodeURIComponent(params.paymentKey)}/cancel`, {
    method: "POST",
    body: {
      cancelReason: params.cancelReason,
    },
    idempotencyKey: params.idempotencyKey,
  });
}

/**
 * 결제 단건 조회. 웹훅 더블체크, 상태 강제 동기화 등에 사용.
 */
export async function retrieveTossPayment(paymentKey: string): Promise<TossCallResult<TossPaymentObject>> {
  return doJsonFetch<TossPaymentObject>(`/v1/payments/${encodeURIComponent(paymentKey)}`, {
    method: "GET",
  });
}

/**
 * orderId로 결제 조회 (토스 측에 paymentKey 조회용).
 */
export async function retrieveTossPaymentByOrderId(orderId: string): Promise<TossCallResult<TossPaymentObject>> {
  return doJsonFetch<TossPaymentObject>(`/v1/payments/orders/${encodeURIComponent(orderId)}`, {
    method: "GET",
  });
}
