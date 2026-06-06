import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  WELCOMEPAY_MOBILE_P_RESERVED,
  generateMobileWelpayPChkfake,
} from "@/lib/bongsim/welcomepay";

describe("모바일 welpay P_CHKFAKE (SHA512+Base64)", () => {
  it("P_RESERVED 상수", () => {
    expect(WELCOMEPAY_MOBILE_P_RESERVED).toBe("centerCd=Y&amt_hash=Y");
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
});
