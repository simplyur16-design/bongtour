import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  WELCOMEPAY_MOBILE_P_RESERVED,
  generateMobileWelpayPChkfake,
  generateMobileWelpayPSignature,
} from "@/lib/bongsim/welcomepay";

describe("모바일 welpay P_CHKFAKE (SHA512+Base64)", () => {
  it("P_SIGNATURE — 샘플 알파벳순 NVP SHA256", () => {
    const sig = generateMobileWelpayPSignature({
      mKey: "abc123",
      pAmt: "1000",
      pOid: "MID_1",
      pTimestamp: "1717500000000",
    });
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
    expect(
      generateMobileWelpayPSignature({
        mKey: "abc123",
        pAmt: "1000",
        pOid: "MID_1",
        pTimestamp: "1717500000000",
      }),
    ).toBe(sig);
  });

  it("매뉴얼 규약: BASE64(SHA512(P_AMT+P_OID+P_TIMESTAMP+HashKey))", () => {
    const pAmt = "15000";
    const pOid = "MID_1717500000000";
    const pTimestamp = "1717500000000";
    const hashKey = "test_hash_key";
    const expected = createHash("sha512")
      .update(`${pAmt}${pOid}${pTimestamp}${hashKey}`, "utf8")
      .digest("base64");
    expect(
      generateMobileWelpayPChkfake({ pAmt, pOid, pTimestamp, hashKey }),
    ).toBe(expected);
  });

  it("KG이니시스 공식 예시(HashKey=mKey hex)", () => {
    expect(
      generateMobileWelpayPChkfake({
        pAmt: "1000",
        pOid: "url_99120",
        pTimestamp: "1640061760611",
        hashKey: "3CB8183A4BE283555ACC8363C0360223",
      }),
    ).toBe("bKVddmNY3kUqWWbeffnPN6r9NatBqhNZe7bx677NyxeLvb42wCRCxEjGx+aH2CATMm0BE8PEKw1x2PqFQbgrsA==");
  });
});
