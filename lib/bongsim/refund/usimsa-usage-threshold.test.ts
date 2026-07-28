import { describe, expect, it } from "vitest";
import { USIMSA_USAGE_MB_EPSILON, isUsimsaUnusedMb } from "@/lib/bongsim/refund/usimsa-usage-threshold";

// REGRESSION-FREEZE[bongsim-admin-esim-usage-check]: unused epsilon SSOT — manifest

describe("isUsimsaUnusedMb", () => {
  it("treats 0 and sub-epsilon as unused", () => {
    expect(USIMSA_USAGE_MB_EPSILON).toBe(0.01);
    expect(isUsimsaUnusedMb(0)).toBe(true);
    expect(isUsimsaUnusedMb(0.01)).toBe(true);
    expect(isUsimsaUnusedMb(0.02)).toBe(false);
  });
});
