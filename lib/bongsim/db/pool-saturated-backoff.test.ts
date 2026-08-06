import { describe, expect, it } from "vitest";
import { shouldBackoffInsteadOfHealOnConnectTimeout } from "@/lib/bongsim/db/pool";

// REGRESSION-FREEZE[bongsim-fulfill-drain-saturated-retry]: saturated → no heal — manifest

describe("shouldBackoffInsteadOfHealOnConnectTimeout", () => {
  it("backs off when pool is fully checked out", () => {
    expect(
      shouldBackoffInsteadOfHealOnConnectTimeout({ total: 8, idle: 0, waiting: 0 }, 8),
    ).toBe(true);
  });

  it("heals when pool has idle capacity or is below max", () => {
    expect(
      shouldBackoffInsteadOfHealOnConnectTimeout({ total: 8, idle: 1, waiting: 0 }, 8),
    ).toBe(false);
    expect(
      shouldBackoffInsteadOfHealOnConnectTimeout({ total: 3, idle: 0, waiting: 2 }, 8),
    ).toBe(false);
  });

  it("heals when stats missing", () => {
    expect(shouldBackoffInsteadOfHealOnConnectTimeout(null, 8)).toBe(false);
  });
});
