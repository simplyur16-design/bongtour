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

  it("hides scheduled packs with no sellable SKU meta (9/1 전 코카서스)", () => {
    const tiles = buildAllMultiCountryTiles({
      "rg-caucasus-3": { isUnlimited: true, travelerVerification: "none", hasSellableSku: false },
      "rg-eu-42": { isUnlimited: true, travelerVerification: "none", hasSellableSku: true },
    });
    expect(tiles.some((t) => t.code === "rg-caucasus-3")).toBe(false);
    expect(tiles.some((t) => t.code === "rg-eu-42")).toBe(true);
  });

  it("hides region packs when catalog meta is missing", () => {
    const tiles = buildAllMultiCountryTiles({});
    expect(tiles.some((t) => t.code === "rg-caucasus-3")).toBe(false);
    expect(tiles.length).toBe(0);
  });
});
