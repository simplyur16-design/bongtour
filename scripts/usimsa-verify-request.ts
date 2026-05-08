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

export type UsimsaSignedGetPrepared = {
  method: "GET";
  pathAndQuery: string;
  pathAndQueryForSign: string;
  timestamp: string;
  stringToSign: string;
  signature: string;
  url: string;
  headers: Record<string, string>;
};

function prepareUsimsaSignedGet(params: {
  baseUrl: string;
  accessKey: string;
  secretKey: string;
  pathAndQuery: string;
  /** 고정 타임스탬프(테스트용). 미지정 시 Date.now() */
  timestampOverride?: string;
}): UsimsaSignedGetPrepared {
  const path = params.pathAndQuery.startsWith("/") ? params.pathAndQuery : `/${params.pathAndQuery}`;
  const queryString = "";
  const pathForSign = path.startsWith("/api") ? path : `/api${path}`;
  const pathAndQueryForSign = `${pathForSign}${queryString}`;
  const timestamp = params.timestampOverride ?? createUsimsaTimestamp();
  const method = "GET" as const;
  const stringToSign = `${method} ${pathAndQueryForSign}\n${timestamp}\n${params.accessKey}`;
  const signature = createUsimsaSignature({
    method,
    pathAndQuery: pathAndQueryForSign,
    timestamp,
    accessKey: params.accessKey,
    secretKey: params.secretKey,
  });
  const url = `${params.baseUrl.replace(/\/+$/, "")}${path}`;
  const headers: Record<string, string> = {
    "x-gat-timestamp": timestamp,
    "x-gat-access-key": params.accessKey,
    "x-gat-signature": signature,
  };
  return {
    method,
    pathAndQuery: path,
    pathAndQueryForSign,
    timestamp,
    stringToSign,
    signature,
    url,
    headers,
  };
}

export function maskAccessKey(k: string): { first5: string; last5: string } {
  if (k.length <= 10) return { first5: `${k.slice(0, 5)}***`, last5: "***" };
  return { first5: k.slice(0, 5), last5: k.slice(-5) };
}

export function maskSecretKeyFirst5(k: string): string {
  return `${k.slice(0, 5)}***`;
}

/** 진단 출력용: 자격증명 마스킹된 헤더 */
export function maskHeadersForLog(h: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(h)) {
    const kl = key.toLowerCase();
    if (kl === "x-gat-access-key") {
      const m = maskAccessKey(val);
      out[key] = `${m.first5}***${m.last5}`;
    } else if (kl === "x-gat-signature") {
      out[key] = val;
    } else {
      out[key] = val;
    }
  }
  return out;
}

/** StringToSign 3번째 줄(accessKey)만 마스킹해 로그용 JSON 생성 */
export function stringToSignForLog(stringToSign: string, accessKey: string): string {
  const lines = stringToSign.split("\n");
  if (lines.length === 3 && lines[2] === accessKey) {
    const m = maskAccessKey(accessKey);
    lines[2] = `${m.first5}***${m.last5}`;
  }
  return JSON.stringify(lines.join("\n"));
}

/** 호출 직전 스냅샷 (문서 6.2 대조용) */
export function snapshotUsimsaSignedGetRequest(params: {
  baseUrl: string;
  accessKey: string;
  secretKey: string;
  pathAndQuery: string;
  timestampOverride?: string;
}): {
  method: string;
  pathAndQueryForSign: string;
  timestampMs: string;
  accessKeyMasked: { first5: string; last5: string };
  secretKeyFirst5Masked: string;
  stringToSignJson: string;
  signature: string;
  requestUrl: string;
  headersMasked: Record<string, string>;
} {
  const p = prepareUsimsaSignedGet(params);
  const ak = maskAccessKey(params.accessKey);
  return {
    method: p.method,
    pathAndQueryForSign: p.pathAndQueryForSign,
    timestampMs: p.timestamp,
    accessKeyMasked: ak,
    secretKeyFirst5Masked: maskSecretKeyFirst5(params.secretKey),
    stringToSignJson: stringToSignForLog(p.stringToSign, params.accessKey),
    signature: p.signature,
    requestUrl: p.url,
    headersMasked: maskHeadersForLog(p.headers),
  };
}

/** 서명 GET (주문 조회·탑업 조회 등). 존재하지 않는 ID면 인증 통과 시 HTTP 200 + 업무 오류 code 가능. */
export async function usimsaSignedGetJson(params: {
  baseUrl: string;
  accessKey: string;
  secretKey: string;
  /** 예: `/v2/topup/bongtour-smoke-nonexistent` */
  pathAndQuery: string;
  timestampOverride?: string;
}): Promise<{ httpStatus: number; parsed: unknown; rawText: string }> {
  const p = prepareUsimsaSignedGet(params);
  const res = await fetch(p.url, {
    method: "GET",
    headers: p.headers,
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
