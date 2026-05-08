/**
 * USIMSA dev 호스트 인증·서명 스모크 (실주문 없음).
 *
 *   npx tsx --env-file=.env.local scripts/usimsa-verify-dev.ts
 */

import {
  resolveUsimsaVerifyAccessKey,
  resolveUsimsaVerifyBaseUrl,
  requireSecretKey,
  usimsaSignedGetJson,
} from "./usimsa-verify-request";

const TOPUP_ID = "bongtour-smoke-nonexistent-topup-id";

async function main() {
  process.env.USIMSA_ENV = "development";

  const baseUrl = resolveUsimsaVerifyBaseUrl("development");
  const { accessKey, source } = resolveUsimsaVerifyAccessKey("development");
  const secretKey = requireSecretKey();

  if (!accessKey) {
    console.error("Missing access key: set USIMSA_ACCESS_KEY (legacy) or USIMSA_DEV_ACCESS_KEY");
    process.exit(1);
  }

  console.log("mode: development");
  console.log("baseUrl:", baseUrl);
  console.log("access_key_source:", source);
  console.log("access_key_length:", accessKey.length);
  console.log("secret_key_length:", secretKey.length);
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
