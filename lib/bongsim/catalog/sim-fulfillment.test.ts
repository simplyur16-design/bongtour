import { describe, expect, it } from "vitest";
import {
  isUsimCapableSimKind,
  normalizeIccid,
  parseFulfillmentMode,
  supportsEsimFulfillment,
  supportsUsimFulfillment,
  validateCustomerIccidsForQuantity,
} from "@/lib/bongsim/catalog/sim-fulfillment";

describe("sim-fulfillment", () => {
  it("parseFulfillmentMode defaults to esim", () => {
    expect(parseFulfillmentMode(undefined)).toBe("esim");
    expect(parseFulfillmentMode("esim")).toBe("esim");
    expect(parseFulfillmentMode("usim")).toBe("usim");
  });

  it("detects dual eSIM/USIM sim_kind", () => {
    expect(supportsEsimFulfillment("eSIM/uSIM")).toBe(true);
    expect(supportsUsimFulfillment("eSIM/uSIM")).toBe(true);
    expect(isUsimCapableSimKind("eSIM")).toBe(false);
    expect(isUsimCapableSimKind("Usim")).toBe(true);
  });

  it("normalizes ICCID digits", () => {
    const sample = "8901 2345 6789 0123 456";
    expect(normalizeIccid(sample)).toBe("8901234567890123456");
    expect(normalizeIccid("123")).toBeNull();
  });

  it("validates ICCID count matches quantity", () => {
    const iccid = "8901234567890123456";
    expect(validateCustomerIccidsForQuantity(1, [iccid])).toEqual({ ok: true, iccids: [iccid] });
    expect(validateCustomerIccidsForQuantity(2, [iccid])).toEqual({ ok: false, code: "iccids_count_mismatch" });
    expect(validateCustomerIccidsForQuantity(1, [iccid, iccid])).toEqual({ ok: false, code: "iccids_count_mismatch" });
    expect(validateCustomerIccidsForQuantity(2, [iccid, iccid])).toEqual({ ok: false, code: "duplicate_iccid" });
  });
});
