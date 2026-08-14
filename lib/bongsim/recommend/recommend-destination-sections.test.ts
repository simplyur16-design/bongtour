import { describe, expect, it } from "vitest";
import { buildAllMultiCountryTiles } from "@/lib/bongsim/recommend/recommend-destination-sections";

// REGRESSION-FREEZE[bongsim-price-effective-from]: hide empty/new region tiles — manifest

describe("buildAllMultiCountryTiles", () => {
  it("hides region packs marked not sellable yet", () => {
    const tiles = buildAllMultiCountryTiles({
      "rg-eu-42": { isUnlimited: true, travelerVerification: "none", hasSellableSku: false },
    });
    expect(tiles.some((t) => t.code === "rg-eu-42")).toBe(false);
  });
});
