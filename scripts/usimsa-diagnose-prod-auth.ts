/**
 * USIMSA prod 인증 실패 진단 (GET만, POST 주문 없음).
 *
 *   npx tsx --env-file=.env.local scripts/usimsa-diagnose-prod-auth.ts
 *
 * 자격증명 평문 출력 없음.
 */

import { spawnSync } from "node:child_process";
import { createUsimsaTimestamp } from "../lib/usimsa/signature";
import {
  maskHeadersForLog,
  snapshotUsimsaSignedGetRequest,
  usimsaSignedGetJson,
} from "./usimsa-verify-request";

const DEV_BASE = "https://open-api-dev.usimsa.com/api";
const PROD_BASE = "https://open-api.usimsa.com/api";
const TOPUP_PATH = `/v2/topup/${encodeURIComponent("test")}`;

function trim(v: string | undefined): string {
  return (v ?? "").trim();
}

type KeyAnalysis = {
  present: boolean;
  rawLen: number | null;
  trimmedLen: number | null;
  trimLenMatch: boolean | null;
  firstCode: number | null;
  lastCode: number | null;
  base64DecodeOk: boolean;
  base64DecodeNote: string;
};

function analyzeKeyValue(_name: string, raw: string | undefined): KeyAnalysis {
  if (raw === undefined) {
    return {
      present: false,
      rawLen: null,
      trimmedLen: null,
      trimLenMatch: null,
      firstCode: null,
      lastCode: null,
      base64DecodeOk: false,
      base64DecodeNote: "env unset",
    };
  }
  const t = raw.trim();
  const base64Like = /^[A-Za-z0-9+/]*=*$/.test(t);
  let decodeOk = false;
  let decodeNote = "";
  try {
    const buf = Buffer.from(t, "base64");
    decodeOk = buf.length > 0;
    decodeNote = `buffer_length=${buf.length}`;
    if (!base64Like && t.includes("-")) {
      decodeNote = `non-base64 charset (e.g. UUID); Node still decoded len=${buf.length}`;
    }
  } catch (e) {
    decodeNote = e instanceof Error ? e.message : "decode error";
  }

  return {
    present: true,
    rawLen: raw.length,
    trimmedLen: t.length,
    trimLenMatch: raw.length === t.length,
    firstCode: t.length ? t.codePointAt(0) ?? null : null,
    lastCode: t.length ? t.codePointAt(t.length - 1) ?? null : null,
    base64DecodeOk: decodeOk,
    base64DecodeNote: decodeNote,
  };
}

function printKeyTableRow(label: string, a: KeyAnalysis): void {
  const trimSame = a.trimLenMatch === null ? "n/a" : a.trimLenMatch ? "yes" : "no";
  const codes =
    a.firstCode != null && a.lastCode != null ? `${a.firstCode} / ${a.lastCode}` : "n/a";
  const b64 = a.present ? `${a.base64DecodeOk} (${a.base64DecodeNote})` : "n/a";
  const len = a.present ? `${a.rawLen} → trimmed ${a.trimmedLen}` : "n/a";
  console.log(`| ${label} | ${len} | ${trimSame} | ${codes} | ${b64} |`);
}

async function runMatrixCell(
  label: string,
  baseUrl: string,
  accessKey: string,
  secretKey: string,
): Promise<{ http: number; body: string }> {
  if (!accessKey || !secretKey) {
    return { http: -1, body: "(skipped: missing key)" };
  }
  const { httpStatus, rawText } = await usimsaSignedGetJson({
    baseUrl,
    accessKey,
    secretKey,
    pathAndQuery: TOPUP_PATH,
  });
  const bodyPreview =
    rawText.length > 500 ? `${rawText.slice(0, 500)}…` : rawText;
  return { http: httpStatus, body: bodyPreview };
}

async function main(): Promise<void> {
  const root = process.cwd();

  console.log("## 1. .env.local 키 무결성 (process.env, --env-file 로 주입 가정)\n");
  const rawProdAk = process.env.USIMSA_PROD_ACCESS_KEY;
  const rawSecret = process.env.USIMSA_SECRET_KEY;
  const rawDevAk = process.env.USIMSA_DEV_ACCESS_KEY;
  const rawLegacy = process.env.USIMSA_ACCESS_KEY;

  console.log("| 변수 | 길이(raw → trim) | trim 전후 동일 | charCode 첫/끝 | Base64 디코드 |");
  console.log("|------|------------------|----------------|----------------|---------------|");
  printKeyTableRow("USIMSA_PROD_ACCESS_KEY", analyzeKeyValue("prod", rawProdAk));
  printKeyTableRow("USIMSA_SECRET_KEY", analyzeKeyValue("secret", rawSecret));
  printKeyTableRow("USIMSA_DEV_ACCESS_KEY", analyzeKeyValue("dev", rawDevAk));
  if (rawLegacy?.trim()) {
    console.log("\n(note) USIMSA_ACCESS_KEY 가 설정되어 있으면 verify-prod 스크립트는 레거시 키를 우선합니다. 매트릭스는 DEV/PROD 키만 사용합니다.");
  }

  console.log("\n## 2. raw 캡처 (prod 키 + prod URL, GET topup/test, 마스킹)\n");
  const prodAk = trim(rawProdAk);
  const secret = trim(rawSecret);
  if (prodAk && secret) {
    const ts = createUsimsaTimestamp();
    const p = snapshotUsimsaSignedGetRequest({
      baseUrl: PROD_BASE,
      accessKey: prodAk,
      secretKey: secret,
      pathAndQuery: TOPUP_PATH,
      timestampOverride: ts,
    });
    console.log("method: GET");
    console.log("pathAndQuery (sign):", p.pathAndQueryForSign);
    console.log("timestamp(ms):", p.timestampMs);
    console.log("accessKey (masked):", `${p.accessKeyMasked.first5}***${p.accessKeyMasked.last5}`);
    console.log("secretKey (first5 only):", p.secretKeyFirst5Masked);
    console.log("stringToSign (line3 accessKey masked, JSON.stringify):", p.stringToSignJson);
    console.log("signature (full):", p.signature);
    console.log("headers (masked):", JSON.stringify(maskHeadersForLog({
      "x-gat-timestamp": p.timestampMs,
      "x-gat-access-key": prodAk,
      "x-gat-signature": p.signature,
    }), null, 2));
    console.log("request URL:", p.requestUrl);
    const res = await usimsaSignedGetJson({
      baseUrl: PROD_BASE,
      accessKey: prodAk,
      secretKey: secret,
      pathAndQuery: TOPUP_PATH,
      timestampOverride: ts,
    });
    console.log("→ 실제 응답 HTTP:", res.httpStatus);
  } else {
    console.log("(skip: USIMSA_PROD_ACCESS_KEY 또는 USIMSA_SECRET_KEY 없음)");
  }

  console.log("\n## 문서 6.2 JS 샘플 대조 항목");
  console.log("- StringToSign: `METHOD path\\ntimestamp\\naccessKey` 3줄 — 위 JSON.stringify 출력에 \\n 이 두 번 포함되는지 확인.");
  console.log("- path: `/api` 접두 포함 — pathAndQuery (sign) 값 확인.");
  console.log("- HMAC: secret Base64 디코드 후 SHA256 — 회귀 스크립트와 동일 구현(`lib/usimsa/signature.ts`).");

  console.log("\n## 3. 시계\n");
  console.log("ISO:", new Date().toISOString());
  console.log("Date.now():", Date.now());
  console.log("(사용자) OS/NTP 시계가 실제 UTC와 크게 어긋나면 일부 API에서 거부될 수 있음 — 본 진단만으로는 USIMSA 정책 미확정.");

  console.log("\n## 4. 키↔환경 4조합 (GET /v2/topup/test, 레거시 키 미사용)\n");
  const devAk = trim(rawDevAk);
  const sk = trim(rawSecret);

  const rows: Array<{ access: string; host: string; http: number; body: string }> = [];
  const a = await runMatrixCell("dev+dev", DEV_BASE, devAk, sk);
  rows.push({ access: "dev", host: "dev", ...a });
  const b = await runMatrixCell("prod+prod", PROD_BASE, prodAk, sk);
  rows.push({ access: "prod", host: "prod", ...b });
  const c = await runMatrixCell("dev+prod", PROD_BASE, devAk, sk);
  rows.push({ access: "dev", host: "prod", ...c });
  const d = await runMatrixCell("prod+dev", DEV_BASE, prodAk, sk);
  rows.push({ access: "prod", host: "dev", ...d });

  console.log("| access_key | host | HTTP | body (앞부분) |");
  console.log("|------------|------|------|---------------|");
  for (const r of rows) {
    const hostLabel = r.host === "dev" ? "open-api-dev" : "open-api";
    const bodyOneLine = r.body.replace(/\s+/g, " ").slice(0, 120);
    console.log(`| ${r.access} | ${hostLabel} | ${r.http} | ${bodyOneLine} |`);
  }

  console.log("\n## 5. 서명 회귀 테스트 (test-usimsa-signature.ts)\n");
  const sig = spawnSync("npx", ["tsx", "scripts/test-usimsa-signature.ts"], {
    cwd: root,
    encoding: "utf8",
    shell: true,
  });
  console.log(sig.stdout?.trim() || "(no stdout)");
  if (sig.stderr?.trim()) console.log("stderr:", sig.stderr.trim());
  console.log("exit_code:", sig.status ?? sig.signal);

  console.log("\n## 6. 진단 결론 (자동 추정, USIMSA 확인 필요)\n");
  const prodProd = rows[1];
  const prodDev = rows[3];
  const devProd = rows[2];
  if (
    prodProd.http === 400 &&
    typeof prodProd.body === "string" &&
    prodProd.body.includes("Invalid accesskey")
  ) {
    console.log("- prod키+prod호스트 가 Invalid accesskey → prod 액세스 키가 prod 게이트에서 거부됨.");
    if (prodDev.http === 200) {
      console.log(
        "  → prod키+dev호스트 가 HTTP 200 이면: 키는 dev에 매핑되어 있고 **prod 쪽 활성화/바인딩** 문제 가능성.",
      );
    } else if (
      prodDev.http === 400 &&
      typeof prodDev.body === "string" &&
      prodDev.body.includes("Invalid accesskey")
    ) {
      console.log(
        "  → prod키+dev호스트 도 Invalid accesskey 이면: **해당 access key 문자열이 양쪽에서 무효**이거나 오타·복사 누락 가능성 (USIMSA에 재확인).",
      );
    }
    if (devProd.http === 400) {
      console.log("- dev키+prod호스트 거부는 dev 키로 prod 호출 시 예상될 수 있음.");
    }
  }
  console.log("- USIMSA 전달용: 위 **stringToSign JSON**, **signature**, **HTTP 응답 본문**, **4조합 표**, **시계 ISO** 를 캡처해 문의.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
