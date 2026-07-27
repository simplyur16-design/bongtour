import { afterEach, describe, expect, it } from "vitest";
import {
  buildWelcomepayEasyPayMobileReserved,
  buildWelcomepayEasyPayPcAcceptMethod,
  listWelcomepayEasyPayCheckoutDefinitions,
  resolveWelcomepayEasyPayEnabled,
} from "@/lib/bongsim/welcomepay-easy-pay";

// REGRESSION-FREEZE[welcomepay-esim-payment]: welcomepay easy pay direct call — manifest

describe("welcomepay-easy-pay", () => {
  const prevEasyPay = process.env.WELCOMEPAY_EASY_PAY;
  const prevEasyMethods = process.env.WELCOMEPAY_EASY_PAY_METHODS;
  const prevNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (prevEasyPay === undefined) delete process.env.WELCOMEPAY_EASY_PAY;
    else process.env.WELCOMEPAY_EASY_PAY = prevEasyPay;
    if (prevEasyMethods === undefined) delete process.env.WELCOMEPAY_EASY_PAY_METHODS;
    else process.env.WELCOMEPAY_EASY_PAY_METHODS = prevEasyMethods;
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;
  });

  it("is disabled in non-production test env by default", () => {
    process.env.NODE_ENV = "test";
    delete process.env.WELCOMEPAY_EASY_PAY;
    expect(resolveWelcomepayEasyPayEnabled()).toBe(false);
    expect(listWelcomepayEasyPayCheckoutDefinitions()).toEqual([]);
  });

  it("lists default easy pay methods when explicitly enabled", () => {
    process.env.WELCOMEPAY_EASY_PAY = "1";
    expect(listWelcomepayEasyPayCheckoutDefinitions().map((m) => m.id)).toEqual([
      "easy_kakaopay",
      "easy_naverpay",
      "easy_tosspay",
      "easy_payco",
      "easy_samsungpay",
    ]);
  });

  it("builds PC acceptmethod and mobile P_RESERVED for kakaopay", () => {
    process.env.WELCOMEPAY_EASY_PAY = "1";
    const kakao = listWelcomepayEasyPayCheckoutDefinitions().find((m) => m.id === "easy_kakaopay")!;
    expect(buildWelcomepayEasyPayPcAcceptMethod()).toBe("centerCd(Y):cardonly");
    expect(kakao.pcGoPayMethod).toBe("onlykakaopay");
    expect(buildWelcomepayEasyPayMobileReserved(kakao, false)).toBe("centerCd=Y&d_kakaopay=Y");
  });

  it("honors WELCOMEPAY_EASY_PAY_METHODS allowlist", () => {
    process.env.WELCOMEPAY_EASY_PAY = "1";
    process.env.WELCOMEPAY_EASY_PAY_METHODS = "kakaopay,tosspay";
    expect(listWelcomepayEasyPayCheckoutDefinitions().map((m) => m.kind)).toEqual(["kakaopay", "tosspay"]);
  });
});
