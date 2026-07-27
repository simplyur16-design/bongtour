import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  listWelcomepayAllCheckoutMethodOptions,
  resolveWelcomepayCheckoutMethodId,
} from "@/lib/bongsim/welcomepay-checkout-options";

// REGRESSION-FREEZE[welcomepay-esim-payment]: welcomepay easy pay checkout options — manifest

describe("welcomepay-checkout-options", () => {
  const prevEasyPay = process.env.WELCOMEPAY_EASY_PAY;
  const prevEasyMethods = process.env.WELCOMEPAY_EASY_PAY_METHODS;
  const prevWelEnv = process.env.WELCOMEPAY_ENV;
  const prevNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (prevEasyPay === undefined) delete process.env.WELCOMEPAY_EASY_PAY;
    else process.env.WELCOMEPAY_EASY_PAY = prevEasyPay;
    if (prevEasyMethods === undefined) delete process.env.WELCOMEPAY_EASY_PAY_METHODS;
    else process.env.WELCOMEPAY_EASY_PAY_METHODS = prevEasyMethods;
    if (prevWelEnv === undefined) delete process.env.WELCOMEPAY_ENV;
    else process.env.WELCOMEPAY_ENV = prevWelEnv;
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;
  });

  it("includes card only when easy pay disabled", () => {
    process.env.WELCOMEPAY_EASY_PAY = "0";
    const ids = listWelcomepayAllCheckoutMethodOptions(false).map((m) => m.id);
    expect(ids).toEqual(["card"]);
    expect(resolveWelcomepayCheckoutMethodId("easy_kakaopay")).toBe("card");
  });

  it("includes easy pay direct params when enabled", () => {
    process.env.NODE_ENV = "production";
    process.env.WELCOMEPAY_ENV = "production";
    process.env.WELCOMEPAY_EASY_PAY = "1";
    process.env.WELCOMEPAY_EASY_PAY_METHODS = "kakaopay,naverpay";
    const opts = listWelcomepayAllCheckoutMethodOptions(false);
    expect(opts.map((m) => m.id)).toEqual(["card", "easy_kakaopay", "easy_naverpay"]);
    const kakao = opts.find((m) => m.id === "easy_kakaopay")!;
    expect(kakao.pc.goPayMethod).toBe("onlykakaopay");
    expect(kakao.pc.acceptMethod).toBe("centerCd(Y):cardonly");
    expect(kakao.mobile.pReserved).toBe("centerCd=Y&d_kakaopay=Y");
    expect(kakao.mobile.submitUrl).toBe("https://mobile.paywelcome.co.kr/smart/wcard/");
    expect(kakao.mobile.pIniPayment).toBe("CARD");
    expect(resolveWelcomepayCheckoutMethodId("easy_naverpay")).toBe("easy_naverpay");
  });
});
