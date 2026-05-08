/**
 * USIMSA Partner API v2 — 서명 GET (실주문 없음).
 * `lib/usimsa/client.ts` / `signature.ts` 와 동일 규칙.
 */

import { createUsimsaSignature, createUsimsaTimestamp } from "../lib/usimsa/signature";

export type UsimsaVerifyMode = "development" | "production";

function trim(v: string | undefined): string {
  return (v ?? "").trim();
}

export function resolveUsimsaVerifyBaseUrl(mode: UsimsaVerifyMode): string {
  const override = trim(process.env.USIMSA_BASE_URL);
  if (override) return override.replace(/\/+$/, "");
  return mode === "production"
    ? "https://open-api.usimsa.com/api"
    : "https://open-api-dev.usimsa.com/api";
}

/** 레거시 단일 키 우선, 없으면 환경별 키. 값은 로그에 출력하지 않음. */
export function resolveUsimsaVerifyAccessKey(mode: UsimsaVerifyMode): {
  accessKey: string;
  source: "legacy" | "dev" | "prod";
} {
  const legacy = trim(process.env.USIMSA_ACCESS_KEY);
  if (legacy) return { accessKey: legacy, source: "legacy" };
  if (mode === "production") {
    const k = trim(process.env.USIMSA_PROD_ACCESS_KEY);
    return { accessKey: k, source: "prod" };
  }
  const k = trim(process.env.USIMSA_DEV_ACCESS_KEY);
  return { accessKey: k, source: "dev" };
}

export function requireSecretKey(): string {
  const k = trim(process.env.USIMSA_SECRET_KEY);
  if (!k) throw new Error("Missing USIMSA_SECRET_KEY");
  return k;
}

/** 서명 GET (주문 조회·탑업 조회 등). 존재하지 않는 ID면 인증 통과 시 HTTP 200 + 업무 오류 code 가능. */
export async function usimsaSignedGetJson(params: {
  baseUrl: string;
  accessKey: string;
  secretKey: string;
  /** 예: `/v2/topup/bongtour-smoke-nonexistent` */
  pathAndQuery: string;
}): Promise<{ httpStatus: number; parsed: unknown; rawText: string }> {
  const path = params.pathAndQuery.startsWith("/") ? params.pathAndQuery : `/${params.pathAndQuery}`;
  const queryString = "";
  const pathForSign = path.startsWith("/api") ? path : `/api${path}`;
  const pathAndQueryForSign = `${pathForSign}${queryString}`;
  const timestamp = createUsimsaTimestamp();
  const signature = createUsimsaSignature({
    method: "GET",
    pathAndQuery: pathAndQueryForSign,
    timestamp,
    accessKey: params.accessKey,
    secretKey: params.secretKey,
  });
  const url = `${params.baseUrl.replace(/\/+$/, "")}${path}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "x-gat-timestamp": timestamp,
      "x-gat-access-key": params.accessKey,
      "x-gat-signature": signature,
    },
    cache: "no-store",
  });
  const rawText = await res.text();
  let parsed: unknown = rawText;
  if (rawText.length > 0) {
    try {
      parsed = JSON.parse(rawText) as unknown;
    } catch {
      parsed = rawText;
    }
  } else {
    parsed = null;
  }
  return { httpStatus: res.status, parsed, rawText };
}
