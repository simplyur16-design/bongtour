import { describe, expect, it } from "vitest";
import { catalogMetaFromSlimRows } from "@/lib/bongsim/data/list-country-catalog-meta";
import { COUNTRY_OPTIONS } from "@/lib/bongsim/country-options";
import { getPlanCoveredCountries } from "@/lib/bongsim/plan-coverage-map";
import { planNamesForRegionPackCode } from "@/lib/bongsim/recommend/region-pack-plan";

// REGRESSION-FREEZE[bongsim-caucasus-transit-pack]: 20260901 조지아·코카서스 경유팩 — manifest

describe("bongsim caucasus transit packs", () => {
  it("maps 조지아(경유팩) to Georgia only so the JP-style country card can find SKUs", () => {
    expect(getPlanCoveredCountries("조지아(경유팩)")).toEqual(["ge"]);
  });

  it("maps 코카서스 3국(경유팩) to GE/AM/AZ, not transit hubs", () => {
    expect(getPlanCoveredCountries("코카서스 3국(경유팩)")).toEqual(["ge", "am", "az"]);
    expect(getPlanCoveredCountries("코카서스 3개국(경유팩)")).toEqual(["ge", "am", "az"]);
  });

  it("keeps Armenia for coverage labels without implying a live country tile", () => {
    expect(COUNTRY_OPTIONS.some((c) => c.code === "am" && c.nameKr === "아르메니아")).toBe(true);
  });

  it("does not mark Caucasus/Armenia sellable from empty catalog rows", () => {
    const meta = catalogMetaFromSlimRows(
      [{ plan_name: "일본", network_family: "roaming", plan_type: "unlimited", allowance_label: "완전 무제한", flags: { kyc: "X" } }],
      ["am", "rg-caucasus-3", "ge"],
    );
    expect(meta.am?.hasSellableSku).toBe(false);
    expect(meta["rg-caucasus-3"]?.hasSellableSku).toBe(false);
  });

  it("Georgia transit pack is a Georgia SKU, not Armenia", () => {
    const meta = catalogMetaFromSlimRows(
      [
        {
          plan_name: "조지아(경유팩)",
          network_family: "roaming",
          plan_type: "daily",
          allowance_label: "500MB",
          flags: { kyc: "X" },
        },
      ],
      ["ge", "am"],
    );
    expect(meta.ge?.hasSellableSku).toBe(true);
    expect(meta.am?.hasSellableSku).toBe(false);
  });

  it("region pack rg-caucasus-3 uses excel plan names", () => {
    expect(planNamesForRegionPackCode("rg-caucasus-3")).toEqual([
      "코카서스 3국(경유팩)",
      "코카서스 3개국(경유팩)",
    ]);
  });
});
