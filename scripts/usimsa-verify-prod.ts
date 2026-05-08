/**
 * USIMSA prod 인증·서명 검증 (1순위·운영 확정용). 실주문(POST /v2/order) 없음.
 *
 * 1) GET /v2/order/test — 가짜 orderId, 인증 통과 시 HTTP 200 + 업무 code(데이터 없음 등)
 * 2) GET /v2/topup/test — 보조(업무 code 1001 등 기대 가능)
 *
 *   npx tsx --env-file=.env.local scripts/usimsa-verify-prod.ts
 *   npx tsx --env-file=.env.local scripts/usimsa-verify-prod.ts --raw
 *
 * 해석:
 * - 두 호출 모두 HTTP 200이면 → 서명·키가 prod에서 받아들여진 것으로 보고 운영 연동 가능 후보.
 * - HTTP 400/401 이거나 본문 "Invalid accesskey." → USIMSA에 prod 키 활성화·권한 추가 문의.
 */

import { createUsimsaTimestamp } from "../lib/usimsa/signature";
import {
  maskHeadersForLog,
  resolveUsimsaVerifyAccessKey,
  resolveUsimsaVerifyBaseUrl,
  resolveUsimsaVerifySecretKey,
  snapshotUsimsaSignedGetRequest,
  usimsaSignedGetJson,
} from "./usimsa-verify-request";

const FAKE_ORDER_ID = "test";
const FAKE_TOPUP_ID = "test";

function extractApiCode(parsed: unknown): string | null {
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const c = (parsed as Record<string, unknown>).code;
    if (typeof c === "string") return c;
    if (c != null && (typeof c === "number" || typeof c === "boolean")) return String(c);
  }
  return null;
}

function summarize(label: string, httpStatus: number, parsed: unknown): void {
  console.log(`\n--- ${label} ---`);
  console.log("HTTP:", httpStatus);
  console.log("body:", JSON.stringify(parsed, null, 2));
  const code = extractApiCode(parsed);
  if (typeof parsed === "string") {
    if (parsed.includes("Invalid accesskey")) {
      console.log(
        "판정: 액세스 키 거부로 보임 → USIMSA에 prod 키·활성화 상태 문의.",
      );
      return;
    }
  }
  if (httpStatus === 401) {
    console.log("판정: HTTP 401 → USIMSA에 인증 정책·키 문의.");
    return;
  }
  if (httpStatus === 400 && typeof parsed === "string") {
    console.log("판정: HTTP 400 본문 확인 → 키/서명/경로 중 하나 불일치 가능.");
    return;
  }
  if (httpStatus === 200) {
    console.log(
      code != null
        ? `판정: HTTP 200 · 업무 code=${code} → 서명·인증 통과로 해석 가능(존재하지 않는 주문/탑업 응답일 수 있음).`
        : "판정: HTTP 200 → 서명·인증 통과로 해석 가능.",
    );
    return;
  }
  console.log("판정: 위 조합은 매뉴얼 확인 필요.");
}

function printRawCapture(
  label: string,
  baseUrl: string,
  accessKey: string,
  secretKey: string,
  pathAndQuery: string,
  timestampMs: string,
): void {
  const p = snapshotUsimsaSignedGetRequest({
    baseUrl,
    accessKey,
    secretKey,
    pathAndQuery,
    timestampOverride: timestampMs,
  });
  console.log(`\n--- RAW ${label} ---`);
  console.log("method: GET");
  console.log("pathAndQuery (sign):", p.pathAndQueryForSign);
  console.log("timestamp(ms):", p.timestampMs);
  console.log("accessKey first5/last5 (masked):", `${p.accessKeyMasked.first5}***${p.accessKeyMasked.last5}`);
  console.log("secretKey first5 (masked):", p.secretKeyFirst5Masked);
  console.log("stringToSign (3rd line accessKey masked, JSON.stringify):", p.stringToSignJson);
  console.log("signature:", p.signature);
  console.log("headers masked:", JSON.stringify(maskHeadersForLog({
    "x-gat-timestamp": p.timestampMs,
    "x-gat-access-key": accessKey,
    "x-gat-signature": p.signature,
  }), null, 2));
  console.log("request URL:", p.requestUrl);
}

async function main() {
  const rawMode = process.argv.includes("--raw");
  process.env.USIMSA_ENV = "production";

  const baseUrl = resolveUsimsaVerifyBaseUrl("production");
  const { accessKey, source } = resolveUsimsaVerifyAccessKey("production");
  const secretMeta = resolveUsimsaVerifySecretKey("production");
  const secretKey = secretMeta.secretKey;

  if (!accessKey) {
    console.error("Missing access key: set USIMSA_ACCESS_KEY (legacy) or USIMSA_PROD_ACCESS_KEY");
    process.exit(1);
  }

  console.log("=== USIMSA prod 검증 (1순위) ===");
  console.log("baseUrl:", baseUrl);
  console.log("access_key_source:", source);
  console.log("access_key_length:", accessKey.length);
  console.log("secret_key_source:", secretMeta.secret_key_source);
  console.log("secret_key_env:", secretMeta.secret_key_env);
  console.log("secret_key_length:", secretMeta.secret_key_length);
  if (rawMode) {
    console.log("\n시계:", new Date().toISOString(), "Date.now():", Date.now());
  }

  const orderPath = `/v2/order/${encodeURIComponent(FAKE_ORDER_ID)}`;
  const topupPath = `/v2/topup/${encodeURIComponent(FAKE_TOPUP_ID)}`;

  console.log("\n[primary] GET", orderPath);
  const tsOrder = rawMode ? createUsimsaTimestamp() : undefined;
  if (rawMode && tsOrder) {
    printRawCapture("order", baseUrl, accessKey, secretKey, orderPath, tsOrder);
  }
  const orderRes = await usimsaSignedGetJson({
    baseUrl,
    accessKey,
    secretKey,
    pathAndQuery: orderPath,
    timestampOverride: tsOrder,
  });
  summarize("GET /v2/order/:orderId (fake)", orderRes.httpStatus, orderRes.parsed);

  console.log("\n[secondary] GET", topupPath);
  const tsTopup = rawMode ? createUsimsaTimestamp() : undefined;
  if (rawMode && tsTopup) {
    printRawCapture("topup", baseUrl, accessKey, secretKey, topupPath, tsTopup);
  }
  const topupRes = await usimsaSignedGetJson({
    baseUrl,
    accessKey,
    secretKey,
    pathAndQuery: topupPath,
    timestampOverride: tsTopup,
  });
  summarize("GET /v2/topup/:topupId (fake)", topupRes.httpStatus, topupRes.parsed);

  const okOrder = orderRes.httpStatus === 200;
  const okTopup = topupRes.httpStatus === 200;
  console.log("\n=== 요약 ===");
  if (okOrder && okTopup) {
    console.log(
      "두 호출 모두 HTTP 200 → prod 키·서명이 USIMSA 운영 API에서 받아들여진 것으로 보고, 운영 연동 준비 완료 후보입니다.",
    );
  } else if (!okOrder || !okTopup) {
    console.log(
      "HTTP 200이 아닌 응답이 있음 → prod 액세스 키 활성화·발급 환경·SECRET 매칭을 USIMSA에 확인하세요.",
    );
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
