import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { WELCOMEPAY_CHECKOUT_METHODS } from "@/lib/bongsim/welcomepay-payment-methods";
import {
  resolveWelcomepayEnv,
  welcomepayMobileSubmitUrlForMethod,
  welcomepayMobileWelpaySubmitUrl,
  welcomepayVbankNotiCallbackUrlRegistered,
} from "@/lib/bongsim/welcomepay";

describe("resolveWelcomepayEnv", () => {
  const prevNode = process.env.NODE_ENV;
  const prevWel = process.env.WELCOMEPAY_ENV;

  afterEach(() => {
    process.env.NODE_ENV = prevNode;
    process.env.WELCOMEPAY_ENV = prevWel;
  });

  it("NODE_ENV=production·WELCOMEPAY_ENV 미설정 → production (iPhone 운영 PG)", () => {
    process.env.NODE_ENV = "production";
    delete process.env.WELCOMEPAY_ENV;
    expect(resolveWelcomepayEnv()).toBe("production");
    expect(welcomepayMobileWelpaySubmitUrl()).toBe(
      "https://mobile.paywelcome.co.kr/smart/wcard/",
    );
    for (const def of WELCOMEPAY_CHECKOUT_METHODS) {
      expect(welcomepayMobileSubmitUrlForMethod(def.id)).toBe(
        `https://mobile.paywelcome.co.kr/smart/${def.mobilePath}/`,
      );
    }
    expect(welcomepayVbankNotiCallbackUrlRegistered()).toContain("/welcomepay-vbank-noti");
  });

  it("WELCOMEPAY_ENV=test → test", () => {
    process.env.NODE_ENV = "production";
    process.env.WELCOMEPAY_ENV = "test";
    expect(resolveWelcomepayEnv()).toBe("test");
    expect(welcomepayMobileWelpaySubmitUrl()).toBe(
      "https://tmobile.paywelcome.co.kr/smart/wcard/",
    );
    expect(welcomepayMobileSubmitUrlForMethod("vbank")).toBe(
      "https://tmobile.paywelcome.co.kr/smart/vbank/",
    );
  });
});
