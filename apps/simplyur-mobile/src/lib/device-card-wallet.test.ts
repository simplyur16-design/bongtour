import { describe, expect, it } from "vitest";
import {
  formatDeviceSavedCardLabel,
  looksLikeForbiddenCardSecret,
  parseDeviceSavedCardList,
  sanitizeDeviceSavedCard,
  serializeDeviceSavedCardList,
} from "./device-card-wallet";

// REGRESSION-FREEZE[simplyur-device-card-wallet]: last4 only, never PAN/CVV — manifest

describe("device-card-wallet", () => {
  it("keeps last4/brand/expiry and drops PAN/CVV blobs", () => {
    const ok = sanitizeDeviceSavedCard({
      brand: "visa",
      last4: "4242",
      expMonth: 12,
      expYear: 29,
      nickname: "Travel",
    });
    expect(ok?.last4).toBe("4242");
    expect(ok?.brand).toBe("visa");
    expect(ok?.expYear).toBe(2029);
    expect(sanitizeDeviceSavedCard({ last4: "4242424242424242" })).toBeNull();
    expect(sanitizeDeviceSavedCard({ last4: "4242", cvv: "123" })).toBeNull();
    expect(looksLikeForbiddenCardSecret({ pan: "4111111111111111" })).toBe(true);
  });

  it("round-trips a short list without extra digit fields", () => {
    const raw = serializeDeviceSavedCardList([
      {
        id: "a",
        brand: "unionpay",
        last4: "8888",
        expMonth: 3,
        expYear: 2028,
        nickname: "",
        savedAt: 1,
      },
    ]);
    expect(raw).not.toMatch(/"last4":"\d{5,}"/);
    expect(raw).not.toMatch(/"cvv"/i);
    const list = parseDeviceSavedCardList(raw);
    expect(list).toHaveLength(1);
    expect(formatDeviceSavedCardLabel(list[0]!)).toContain("8888");
  });
});
