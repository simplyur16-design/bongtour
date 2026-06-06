import { describe, expect, it } from "vitest";
import {
  WELCOMEPAY_MOBILE_OID_COOKIE,
  pickOidFromWelpayCookie,
  welcomepayMobileOidCookieSetHeader,
} from "@/lib/bongsim/welcomepay-mobile-oid-cookie";

describe("welcomepay-mobile-oid-cookie", () => {
  it("prepare Set-Cookie → mobile-next 에서 oid 복구", () => {
    const oid = "welcomepayMID_1717500000000";
    const req = new Request("https://bongtour.com/api/bongsim/checkout/welcomepay-mobile-next", {
      headers: { cookie: welcomepayMobileOidCookieSetHeader(oid).split(";")[0] },
    });
    expect(pickOidFromWelpayCookie(req)).toBe(oid);
  });

  it("쿠키 없으면 빈 문자열", () => {
    const req = new Request("https://bongtour.com/api/bongsim/checkout/welcomepay-mobile-next");
    expect(pickOidFromWelpayCookie(req)).toBe("");
  });

  it("다른 쿠키와 섞여 있어도 파싱", () => {
    const req = new Request("https://bongtour.com/api/bongsim/checkout/welcomepay-mobile-next", {
      headers: {
        cookie: `foo=bar; ${WELCOMEPAY_MOBILE_OID_COOKIE}=oid_test_1; baz=qux`,
      },
    });
    expect(pickOidFromWelpayCookie(req)).toBe("oid_test_1");
  });
});
