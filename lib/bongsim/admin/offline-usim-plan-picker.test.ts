import { describe, expect, it } from "vitest";
import {
  filterOfflineUsimDestinations,
  offlineUsimSelectedSummary,
  toggleOfflineUsimDestinationSelection,
} from "@/lib/bongsim/admin/offline-usim-destination-options";
import { BONGSIM_CATALOG_OFFLINE_USIM_WHERE } from "@/lib/bongsim/catalog/active-product-sql";

describe("offline-usim-destination-options", () => {
  it("toggle country multi-select clears region pack", () => {
    expect(toggleOfflineUsimDestinationSelection(["rg-eu-42"], "jp")).toEqual(["jp"]);
    expect(toggleOfflineUsimDestinationSelection(["jp"], "th")).toEqual(["jp", "th"]);
    expect(toggleOfflineUsimDestinationSelection(["jp", "th"], "jp")).toEqual(["th"]);
  });

  it("region pack is exclusive single-select", () => {
    expect(toggleOfflineUsimDestinationSelection(["jp", "th"], "rg-sea-3")).toEqual(["rg-sea-3"]);
    expect(toggleOfflineUsimDestinationSelection(["rg-sea-3"], "rg-sea-3")).toEqual([]);
  });

  it("unified search finds country and pack", () => {
    const hits = filterOfflineUsimDestinations("일본");
    expect(hits.some((h) => h.code === "jp" && h.kind === "country")).toBe(true);
    const eu = filterOfflineUsimDestinations("유럽");
    expect(eu.some((h) => h.kind === "pack")).toBe(true);
  });

  it("summary for multi-country", () => {
    expect(offlineUsimSelectedSummary(["jp", "th"])).toBe("일본 · 태국");
  });
});

describe("BONGSIM_CATALOG_OFFLINE_USIM_WHERE", () => {
  it("requires active, esim-capable, and usim-capable", () => {
    expect(BONGSIM_CATALOG_OFFLINE_USIM_WHERE).toContain("is_active = true");
    expect(BONGSIM_CATALOG_OFFLINE_USIM_WHERE.toLowerCase()).toContain("esim");
    expect(BONGSIM_CATALOG_OFFLINE_USIM_WHERE.toLowerCase()).toContain("usim");
  });
});

describe("admin plan catalog slim price with supply", () => {
  it("WITH_SUPPLY SQL includes supply_krw extract", async () => {
    const {
      BONGSIM_CATALOG_SLIM_PRICE_BLOCK_SQL,
      BONGSIM_CATALOG_SLIM_PRICE_BLOCK_WITH_SUPPLY_SQL,
      BONGSIM_CATALOG_SUPPLY_KRW_SQL,
    } = await import("@/lib/bongsim/data/catalog-consumer-krw-sql");
    expect(BONGSIM_CATALOG_SLIM_PRICE_BLOCK_SQL).toContain("consumer_krw");
    expect(BONGSIM_CATALOG_SLIM_PRICE_BLOCK_SQL).not.toContain("supply_krw");
    expect(BONGSIM_CATALOG_SUPPLY_KRW_SQL).toContain("supply_krw");
    expect(BONGSIM_CATALOG_SLIM_PRICE_BLOCK_WITH_SUPPLY_SQL).toContain("supply_krw");
    expect(BONGSIM_CATALOG_SLIM_PRICE_BLOCK_WITH_SUPPLY_SQL).toContain("consumer_krw");
  });
});
