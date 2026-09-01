import { describe, expect, it } from "vitest";
import {
  BONGTOUR_ESIM_AFFILIATION_DISCOUNT,
  BONGTOUR_ESIM_AFFILIATION_NET_OVER_SUPPLY,
  BONGTOUR_ESIM_CS_COST_OF_SUPPLY,
  BONGTOUR_ESIM_LIST_OVER_SUPPLY,
  BONGTOUR_ESIM_PROFIT_OF_SUPPLY,
  bongtourAffiliationFloorNetFromSupplyKrw,
  bongtourEsimListPriceFromSupplyKrw,
  bongtourHomepageListKrw,
} from "@/lib/bongsim/data/pricing-bongtour-list";
import { BONGSIM_CATALOG_CONSUMER_KRW_SQL } from "@/lib/bongsim/data/catalog-consumer-krw-sql";
import { affiliationMemberNetKrw } from "@/lib/bongsim/press/affiliation-member-display-price";

// REGRESSION-FREEZE[bongsim-display-recommended-floor]: 표시=권장소비자가 · 명함 1.25 — manifest

describe("bongtour homepage list = 권장소비자가; affiliation floor = 1.25×supply", () => {
  it("locks CS 10% + profit 15% = supply × 1.25 for affiliation only", () => {
    expect(BONGTOUR_ESIM_CS_COST_OF_SUPPLY).toBe(0.1);
    expect(BONGTOUR_ESIM_PROFIT_OF_SUPPLY).toBe(0.15);
    expect(BONGTOUR_ESIM_AFFILIATION_DISCOUNT).toBe(0.25);
    expect(BONGTOUR_ESIM_AFFILIATION_NET_OVER_SUPPLY).toBe(1.25);
    expect(BONGTOUR_ESIM_LIST_OVER_SUPPLY).toBeCloseTo(5 / 3, 10);
  });

  it("homepage shows 권장소비자가, not 소비자가 and not supply×5/3", () => {
    expect(
      bongtourHomepageListKrw({ recommended_krw: 4300, consumer_krw: 4700, supply_krw: 2350 }),
    ).toBe(4300);
    expect(bongtourEsimListPriceFromSupplyKrw(2350)).toBe(3920);
  });

  it("affiliation 25% off 권장 4300 leaves 3225, above supply×1.25 (2940)", () => {
    const net = affiliationMemberNetKrw(4300, 2350);
    expect(net).toBe(3225);
    expect(bongtourAffiliationFloorNetFromSupplyKrw(2350)).toBe(2940);
    expect(net).toBeGreaterThanOrEqual(2940);
  });

  it("caps affiliation at supply × 1.25 마지노선", () => {
    expect(bongtourAffiliationFloorNetFromSupplyKrw(3600)).toBe(4500);
    expect(affiliationMemberNetKrw(4000, 3600)).toBe(4000);
  });

  it("falls back to consumer then supply when 권장 is missing", () => {
    expect(
      bongtourHomepageListKrw({ recommended_krw: null, consumer_krw: 4700, supply_krw: 2350 }),
    ).toBe(4700);
    expect(
      bongtourHomepageListKrw({ recommended_krw: null, consumer_krw: null, supply_krw: 3600 }),
    ).toBe(6000);
  });

  it("catalog slim SQL uses recommended first", () => {
    expect(BONGSIM_CATALOG_CONSUMER_KRW_SQL).toContain("recommended_krw");
    expect(BONGSIM_CATALOG_CONSUMER_KRW_SQL).not.toContain("GREATEST(");
    expect(BONGSIM_CATALOG_CONSUMER_KRW_SQL.indexOf("recommended_krw")).toBeLessThan(
      BONGSIM_CATALOG_CONSUMER_KRW_SQL.indexOf("5.0 / 3.0"),
    );
  });
});
