/**
 * USIMSA dev 호스트 인증·서명 스모크 (2순위·로컬 backward 호환). 실주문 없음.
 * 운영 확정은 `scripts/usimsa-verify-prod.ts`를 우선 실행한다.
 *
 *   npx tsx --env-file=.env.local scripts/usimsa-verify-dev.ts
 */

import {
  resolveUsimsaVerifyAccessKey,
  resolveUsimsaVerifyBaseUrl,
  resolveUsimsaVerifySecretKey,
  usimsaSignedGetJson,
} from "./usimsa-verify-request";

const TOPUP_ID = "bongtour-smoke-nonexistent-topup-id";

async function main() {
  process.env.USIMSA_ENV = "development";

  const baseUrl = resolveUsimsaVerifyBaseUrl("development");
  const { accessKey, source } = resolveUsimsaVerifyAccessKey("development");
  const secretMeta = resolveUsimsaVerifySecretKey("development");
  const secretKey = secretMeta.secretKey;

  if (!accessKey) {
    console.error("Missing access key: set USIMSA_ACCESS_KEY (legacy) or USIMSA_DEV_ACCESS_KEY");
    process.exit(1);
  }

  console.log("mode: development");
  console.log("baseUrl:", baseUrl);
  console.log("access_key_source:", source);
  console.log("access_key_length:", accessKey.length);
  console.log("secret_key_source:", secretMeta.secret_key_source);
  console.log("secret_key_env:", secretMeta.secret_key_env);
  console.log("secret_key_length:", secretMeta.secret_key_length);
  console.log("GET path:", `/v2/topup/${TOPUP_ID}`);

  const { httpStatus, parsed } = await usimsaSignedGetJson({
    baseUrl,
    accessKey,
    secretKey,
    pathAndQuery: `/v2/topup/${encodeURIComponent(TOPUP_ID)}`,
  });

  console.log("HTTP:", httpStatus);
  console.log("body:", JSON.stringify(parsed, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
