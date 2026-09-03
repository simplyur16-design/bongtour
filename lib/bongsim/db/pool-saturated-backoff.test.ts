import { describe, expect, it } from "vitest";
import {
  classifyBongsimPgError,
  isBongsimPgSaturatedMaxClients,
  shouldBackoffInsteadOfHealOnConnectTimeout,
  shouldSkipCatalogHealBecauseSaturated,
} from "@/lib/bongsim/db/pool";

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

describe("shouldSkipCatalogHealBecauseSaturated", () => {
  it("skips heal on live EMAXCONN so homepage does not open more slots", () => {
    expect(
      isBongsimPgSaturatedMaxClients(
        new Error("(EMAXCONN) max client connections reached, limit: 200"),
      ),
    ).toBe(true);
    expect(
      shouldSkipCatalogHealBecauseSaturated(
        new Error("(EMAXCONN) max client connections reached, limit: 200"),
      ),
    ).toBe(true);
    expect(shouldSkipCatalogHealBecauseSaturated("by-country:connection_timeout")).toBe(true);
  });

  it("does not treat ordinary SQL as saturated", () => {
    expect(isBongsimPgSaturatedMaxClients(new Error("relation does not exist"))).toBe(false);
  });

  it("classify EMAXCONN as connection_timeout and arms heal-skip for label heals", () => {
    expect(
      classifyBongsimPgError(
        new Error("FATAL: (EMAXCONN) max client connections reached, limit: 200"),
      ),
    ).toBe("connection_timeout");
    expect(shouldSkipCatalogHealBecauseSaturated("order-paid-outbox-cron-timeout")).toBe(true);
  });
});
