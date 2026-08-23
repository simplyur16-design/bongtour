import { describe, expect, it } from "vitest";
import {
  BONGTOUR_ESIM_AFFILIATION_DISCOUNT,
  BONGTOUR_ESIM_CS_COST_OF_SUPPLY,
  BONGTOUR_ESIM_LIST_OVER_SUPPLY,
  BONGTOUR_ESIM_PROFIT_OF_SUPPLY,
  bongtourEsimListPriceFromSupplyKrw,
} from "@/lib/bongsim/data/pricing-bongtour-list";
import { affiliationMemberNetKrw } from "@/lib/bongsim/press/affiliation-member-display-price";

describe("bongtourEsimListPriceFromSupplyKrw", () => {
  it("locks 5/3 list so 25% off leaves CS 10% + profit 15% of supply", () => {
    expect(BONGTOUR_ESIM_CS_COST_OF_SUPPLY).toBe(0.1);
    expect(BONGTOUR_ESIM_PROFIT_OF_SUPPLY).toBe(0.15);
    expect(BONGTOUR_ESIM_AFFILIATION_DISCOUNT).toBe(0.25);
    expect(BONGTOUR_ESIM_LIST_OVER_SUPPLY).toBeCloseTo(5 / 3, 10);
  });

  it("sets 3600 supply → 6000 list; 25% off leaves 540 profit (15%)", () => {
    const list = bongtourEsimListPriceFromSupplyKrw(3600);
    expect(list).toBe(6000);
    const net = affiliationMemberNetKrw(list!);
    expect(net).toBe(4500);
    const cs = 3600 * 0.1;
    const profit = net - 3600 - cs;
    expect(profit).toBe(540);
  });

  it("rounds up to 10 won", () => {
    expect(bongtourEsimListPriceFromSupplyKrw(8050)).toBe(13420);
    expect(bongtourEsimListPriceFromSupplyKrw(1100)).toBe(1840);
  });
});
