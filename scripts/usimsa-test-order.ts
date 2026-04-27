/**
 * USIMSA POST /v2/order — API 문서 JavaScript 샘플과 동일한 서명 규칙, Node 내장 crypto만 사용.
 * (프로젝트 `lib/usimsa` 미사용 — server-only 없음)
 *
 *   npx tsx --env-file=.env.local scripts/usimsa-test-order.ts
 */

import crypto from "node:crypto";

const USIMSA_ORDER_URL = "https://open-api-dev.usimsa.com/api/v2/order";
const OPTION_ID = "40FB98E5-12B6-EE11-B65E-6045BD45CB1E";
const QTY = 4;

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    throw new Error(`Missing env: ${name}`);
  }
  return v;
}

function usimsaSignature(secretKeyBase64: string, stringToSign: string): string {
  const key = Buffer.from(secretKeyBase64, "base64");
  return crypto.createHmac("sha256", key).update(stringToSign, "utf8").digest("base64");
}

async function main() {
  const accessKey = requireEnv("USIMSA_ACCESS_KEY");
  const secretKey = requireEnv("USIMSA_SECRET_KEY");

  const timestamp = Date.now();
  const method = "POST";
  const pathAndQuery = "/api/v2/order";
  const stringToSign = `${method} ${pathAndQuery}\n${timestamp}\n${accessKey}`;
  const signature = usimsaSignature(secretKey, stringToSign);

  const orderId = `BONGTOUR-TEST-${timestamp}`;
  const body = {
    orderId,
    products: [{ optionId: OPTION_ID, qty: QTY }],
  };
  const bodyStr = JSON.stringify(body);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-gat-timestamp": String(timestamp),
    "x-gat-access-key": accessKey,
    "x-gat-signature": signature,
  };

  console.log("=== DEBUG (before fetch) ===");
  console.log("stringToSign (full, exact bytes for HMAC input after UTF-8 encode):");
  console.log(JSON.stringify(stringToSign));
  console.log("signature (Base64):", signature);
  console.log("Request headers (all values):");
  console.log(JSON.stringify(headers, null, 2));
  console.log("Request URL:", USIMSA_ORDER_URL);
  console.log("Request body:", bodyStr);
  console.log("");

  const res = await fetch(USIMSA_ORDER_URL, {
    method: "POST",
    headers,
    body: bodyStr,
  });

  const text = await res.text();
  let parsed: unknown = text;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = text;
    }
  }

  const resHeaders: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    resHeaders[k] = v;
  });

  console.log("=== RESPONSE ===");
  console.log("status:", res.status, res.statusText);
  console.log("headers (full):");
  console.log(JSON.stringify(resHeaders, null, 2));
  console.log("body (raw text):");
  console.log(text);
  console.log("body (parsed JSON if valid):");
  console.log(JSON.stringify(parsed, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
