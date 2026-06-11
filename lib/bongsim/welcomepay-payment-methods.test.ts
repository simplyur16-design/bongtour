import { describe, expect, it } from "vitest";
import {
  buildWelcomepayMobileReserved,
  buildWelcomepayPcAcceptMethod,
  getWelcomepayMethodDefinition,
  resolveWelcomepayMethodId,
  WELCOMEPAY_CHECKOUT_METHODS,
} from "@/lib/bongsim/welcomepay-payment-methods";

describe("welcomepay-payment-methods", () => {
  it("checkout methods exclude culture (미계약)", () => {
    const ids = WELCOMEPAY_CHECKOUT_METHODS.map((m) => m.id).sort();
    expect(ids).toEqual(["bank", "card", "hpp", "overseas", "vbank"]);
    const paths = WELCOMEPAY_CHECKOUT_METHODS.map((m) => m.mobilePath).sort();
    expect(paths).toEqual(["bank", "etc", "mobile", "vbank", "wcard"]);
  });

  it("resolveWelcomepayMethodId — unknown defaults to card", () => {
    expect(resolveWelcomepayMethodId("vbank")).toBe("vbank");
    expect(resolveWelcomepayMethodId("VBANK")).toBe("vbank");
    expect(resolveWelcomepayMethodId("culture")).toBe("card");
    expect(resolveWelcomepayMethodId("")).toBe("card");
    expect(resolveWelcomepayMethodId(null)).toBe("card");
  });

  it("buildWelcomepayPcAcceptMethod — centerCd(Y) 필수 + 수단별", () => {
    expect(buildWelcomepayPcAcceptMethod("card")).toBe("centerCd(Y)");
    expect(buildWelcomepayPcAcceptMethod("overseas")).toBe("centerCd(Y):GLOBAL");
    expect(buildWelcomepayPcAcceptMethod("bank")).toBe("centerCd(Y):va_receipt");
    expect(buildWelcomepayPcAcceptMethod("vbank", new Date("2026-06-03T00:00:00+09:00"))).toBe(
      "centerCd(Y):va_receipt:vbank(20260610)",
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
    expect(buildWelcomepayMobileReserved(vbank, false)).toContain("vbank_receipt=Y");
  });
});
