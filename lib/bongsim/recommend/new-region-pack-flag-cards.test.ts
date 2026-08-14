import { describe, expect, it } from "vitest";
import { resolveBongsimCountryHeroUrl } from "@/lib/bongsim/recommend/popular-destinations";
import { regionPackTileVisual } from "@/lib/bongsim/recommend/region-pack-badge-visual";

describe("new region pack flag cards", () => {
  it("uses carousel flags for new multi packs", () => {
    expect(regionPackTileVisual("rg-benelux-3").type).toBe("carousel");
    expect(regionPackTileVisual("rg-me-6").type).toBe("carousel");
    expect(regionPackTileVisual("rg-kr-jp").type).toBe("carousel");
  });

  it("falls back region hero to coverage country hero", () => {
    const map = { nl: "https://example.com/nl.webp", kr: "https://example.com/kr.webp", sa: "https://example.com/sa.webp" };
    expect(resolveBongsimCountryHeroUrl("rg-benelux-3", map)).toBe(map.nl);
    expect(resolveBongsimCountryHeroUrl("rg-kr-jp", map)).toBe(map.kr);
    expect(resolveBongsimCountryHeroUrl("rg-me-6", map)).toBe(map.sa);
  });
});
