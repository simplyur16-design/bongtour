import { describe, expect, it } from "vitest";
import {
  buildWelcomepayMobileReserved,
  getWelcomepayMethodDefinition,
  resolveWelcomepayMethodId,
  WELCOMEPAY_CHECKOUT_METHODS,
} from "@/lib/bongsim/welcomepay-payment-methods";

describe("welcomepay-payment-methods", () => {
  it("covers all Mobile Web §1.2 smart paths", () => {
    const paths = WELCOMEPAY_CHECKOUT_METHODS.map((m) => m.mobilePath).sort();
    expect(paths).toEqual(["bank", "cgft", "etc", "mobile", "vbank", "wcard"]);
  });

  it("resolveWelcomepayMethodId — unknown defaults to card", () => {
    expect(resolveWelcomepayMethodId("vbank")).toBe("vbank");
    expect(resolveWelcomepayMethodId("VBANK")).toBe("vbank");
    expect(resolveWelcomepayMethodId("")).toBe("card");
    expect(resolveWelcomepayMethodId(null)).toBe("card");
  });

  it("buildWelcomepayMobileReserved merges base + extras", () => {
    const bank = getWelcomepayMethodDefinition("bank");
    expect(buildWelcomepayMobileReserved(bank)).toContain("centerCd=Y");
    expect(buildWelcomepayMobileReserved(bank)).toContain("twotrs_bank=Y");
    const card = getWelcomepayMethodDefinition("card");
    expect(buildWelcomepayMobileReserved(card)).toBe("centerCd=Y&amt_hash=Y");
  });
});
