import { createHmac } from "node:crypto";

/**
 * USIMSA Partner API v2 서명 (문서 6.x).
 * StringToSign = `{METHOD} {pathAndQuery}\n{timestamp}\n{accessKey}` — 줄바꿈 2개(정확히 3줄).
 * METHOD 대문자, pathAndQuery는 `/api` 접두 포함(예: `/api/v2/order`).
 * timestamp: 밀리초 문자열 (`Date.now()`).
 * HMAC-SHA256 키 = `Buffer.from(secretKey, "base64")`, 입력 UTF-8, 출력 Base64.
 */

export function createUsimsaTimestamp(): string {
  return String(Date.now());
}

export function createUsimsaSignature(params: {
  method: string;
  pathAndQuery: string;
  timestamp: string;
  accessKey: string;
  secretKey: string;
}): string {
  const method = params.method.toUpperCase();
  const stringToSign = `${method} ${params.pathAndQuery}\n${params.timestamp}\n${params.accessKey}`;
  const hmac = createHmac("sha256", Buffer.from(params.secretKey, "base64"));
  hmac.update(stringToSign, "utf8");
  return hmac.digest("base64");
}
