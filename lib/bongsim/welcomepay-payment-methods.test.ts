import { afterEach, describe, expect, it } from "vitest";
import {
  buildWelcomepayMobileReserved,
  buildWelcomepayPcAcceptMethod,
  buildWelcomepayPgGoodsName,
  getWelcomepayMethodDefinition,
  listWelcomepayCheckoutMethods,
  resolveWelcomepayMethodId,
  WELCOMEPAY_CHECKOUT_METHODS,
} from "@/lib/bongsim/welcomepay-payment-methods";

describe("welcomepay-payment-methods", () => {
  const prevCheckoutMethods = process.env.WELCOMEPAY_CHECKOUT_METHODS;

  afterEach(() => {
    if (prevCheckoutMethods === undefined) delete process.env.WELCOMEPAY_CHECKOUT_METHODS;
    else process.env.WELCOMEPAY_CHECKOUT_METHODS = prevCheckoutMethods;
  });

  it("checkout methods — 기본 신용카드만", () => {
    expect(WELCOMEPAY_CHECKOUT_METHODS.map((m) => m.id)).toEqual(["card"]);
    expect(WELCOMEPAY_CHECKOUT_METHODS[0]?.mobilePath).toBe("wcard");
  });

  it("checkout methods — env에 vbank,bank 있어도 미노출", () => {
    process.env.WELCOMEPAY_CHECKOUT_METHODS = "card,vbank,bank";
    expect(listWelcomepayCheckoutMethods().map((m) => m.id)).toEqual(["card"]);
  });

  it("resolveWelcomepayMethodId — unknown defaults to card", () => {
    expect(resolveWelcomepayMethodId("vbank")).toBe("card");
    expect(resolveWelcomepayMethodId("bank")).toBe("card");
    expect(resolveWelcomepayMethodId("culture")).toBe("card");
    expect(resolveWelcomepayMethodId("hpp")).toBe("card");
    expect(resolveWelcomepayMethodId("overseas")).toBe("card");
    expect(resolveWelcomepayMethodId("")).toBe("card");
    expect(resolveWelcomepayMethodId(null)).toBe("card");
  });

  it("buildWelcomepayPcAcceptMethod — centerCd(Y) 필수 + 수단별", () => {
    expect(buildWelcomepayPcAcceptMethod("card")).toBe("centerCd(Y)");
    expect(buildWelcomepayPcAcceptMethod("overseas")).toBe("centerCd(Y):GLOBAL");
    expect(buildWelcomepayPcAcceptMethod("bank")).toBe("centerCd(Y):no_receipt");
    expect(buildWelcomepayPcAcceptMethod("vbank", new Date("2026-06-03T00:00:00+09:00"))).toBe(
      "centerCd(Y):no_receipt:vbank(20260610)",
    );
  });

  it("buildWelcomepayMobileReserved merges base + extras", () => {
    const bank = getWelcomepayMethodDefinition("bank");
    expect(buildWelcomepayMobileReserved(bank, false)).toContain("centerCd=Y");
    expect(buildWelcomepayMobileReserved(bank, false)).not.toContain("amt_hash=Y");
    expect(buildWelcomepayMobileReserved(bank, false)).toContain("twotrs_bank=Y");
    const card = getWelcomepayMethodDefinition("card");
    expect(buildWelcomepayMobileReserved(card, true)).toContain("amt_hash=Y");
    expect(buildWelcomepayMobileReserved(card, false)).toContain("twotrs_isp=Y");
    const vbank = getWelcomepayMethodDefinition("vbank");
    const vbankReserved = buildWelcomepayMobileReserved(vbank, false, new Date("2026-06-03T00:00:00+09:00"));
    expect(vbankReserved).toContain("P_VBANK_DT=20260610");
    expect(vbankReserved).toContain("P_VBANK_TM=2359");
    expect(vbankReserved).toContain("bank_receipt=N");
  });

  it("buildWelcomepayPgGoodsName — 주문번호 기반 SSOT", () => {
    expect(buildWelcomepayPgGoodsName("BS-20260603-ABC")).toBe("Bong투어 eSIM BS-20260603-ABC");
    expect(buildWelcomepayPgGoodsName("  BS-1  ")).toBe("Bong투어 eSIM BS-1");
  });
});
