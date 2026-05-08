/**
 * USIMSA v2 StringToSign + HMAC 골든 벡터 (실 API 호출 없음).
 * 고정 입력으로 알고리즘 회귀 방지.
 *
 *   npx tsx scripts/test-usimsa-signature.ts
 */

import { createUsimsaSignature } from "../lib/usimsa/signature";

const EXPECTED = "8sp8PeNByZ7j0hfRK/9J4v2fcSUbzNy26FcgvFwBA9U=";

function main() {
  const sig = createUsimsaSignature({
    method: "GET",
    pathAndQuery: "/api/v2/topup/verify-golden",
    timestamp: "1700000000123",
    accessKey: "AK-GOLDEN-TEST",
    secretKey: "MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=",
  });
  if (sig !== EXPECTED) {
    console.error("FAIL: expected", EXPECTED, "got", sig);
    process.exit(1);
  }
  console.log("OK: signature matches golden vector");
}

main();
