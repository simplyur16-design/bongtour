import { describe, expect, it } from "vitest";
import { simplyurSellPriceKrw } from "@/lib/simplyur/pricing";
import {
  SIMPLYUR_LAUNCH_DISCOUNT_RATE_PCT,
  SIMPLYUR_LAUNCH_MIN_MULTIPLE_ON_SUPPLY,
  SIMPLYUR_LAUNCH_PG_FEE_KRW,
  computeSimplyurLaunchDiscountForCheckoutLines,
  computeSimplyurLaunchUnitDiscountKrw,
  simplyurLaunchMinSellKrw,
} from "@/lib/simplyur/pricing/launch-discount";

// REGRESSION-FREEZE[simplyur-launch-discount-14pct]: 14% · MAP · cheap-SKU skip — manifest

describe("simplyur launch 14%", () => {
  it("rate SSOT is 14 (not bongsim 15)", () => {
    expect(SIMPLYUR_LAUNCH_DISCOUNT_RATE_PCT).toBe(14);
    expect(SIMPLYUR_LAUNCH_PG_FEE_KRW).toBe(600);
    expect(SIMPLYUR_LAUNCH_MIN_MULTIPLE_ON_SUPPLY).toBe(1.25);
  });

  it("typical SKU: 14% stays above 권장소비자가 and margin floor", () => {
    const consumer = 10_000;
    const list = simplyurSellPriceKrw({ after: { consumer_krw: consumer } })!;
    const recommended = 9_000;
    const supply = 5_000;
    const discount = computeSimplyurLaunchUnitDiscountKrw({
      list_krw: list,
      recommended_krw: recommended,
      supply_krw: supply,
    });
    expect(list).toBe(10_500);
    expect(discount).toBe(Math.floor((list * 14) / 100));
    expect(list - discount).toBeGreaterThanOrEqual(recommended);
    expect(list - discount).toBeGreaterThanOrEqual(simplyurLaunchMinSellKrw({ recommended_krw: recommended, supply_krw: supply }));
  });

  it("clamps to 권장소비자가 when 14% would dip slightly below MAP", () => {
    const discount = computeSimplyurLaunchUnitDiscountKrw({
      list_krw: 10_500,
      recommended_krw: 9_100,
      supply_krw: 4_000,
    });
    expect(10_500 - discount).toBe(9_100);
    expect(discount).toBe(1_400);
  });

  it("1-day 500MB: list is already below 15%-of-supply+PG — no extra discount", () => {
    const consumer = 1_300;
    const list = simplyurSellPriceKrw({ after: { consumer_krw: consumer } })!;
    const discount = computeSimplyurLaunchUnitDiscountKrw({
      list_krw: list,
      recommended_krw: 1_170,
      supply_krw: 650,
    });
    expect(list).toBe(1_365);
    expect(simplyurLaunchMinSellKrw({ recommended_krw: 1_170, supply_krw: 650 })).toBe(1_413);
    expect(discount).toBe(0);
  });

  it("1-day 2GB: 14% would miss margin floor — skip (keep list)", () => {
    const list = simplyurSellPriceKrw({ after: { consumer_krw: 2_100 } })!;
    const discount = computeSimplyurLaunchUnitDiscountKrw({
      list_krw: list,
      recommended_krw: 1_890,
      supply_krw: 1_050,
    });
    expect(list).toBe(2_205);
    expect(discount).toBe(0);
  });

  it("1-day 1GB / 2-day 500MB class (supply 900): skip", () => {
    const list = simplyurSellPriceKrw({ after: { consumer_krw: 1_800 } })!;
    expect(
      computeSimplyurLaunchUnitDiscountKrw({
        list_krw: list,
        recommended_krw: 1_620,
        supply_krw: 900,
      }),
    ).toBe(0);
  });

  it("does not apply 15% that would breach 권장소비자가 on 1-day 500MB list", () => {
    const list = 1_365;
    const fifteenOff = list - Math.floor((list * 15) / 100);
    expect(fifteenOff).toBeLessThan(1_170);
    const fourteenNet = list - Math.floor((list * 14) / 100);
    expect(fourteenNet).toBeGreaterThanOrEqual(1_170);
  });

  it("reads recommended + supply from price_block for checkout lines", () => {
    const list = simplyurSellPriceKrw({ after: { consumer_krw: 10_000 } })!;
    const discount = computeSimplyurLaunchDiscountForCheckoutLines([
      {
        unit_krw: list,
        quantity: 2,
        price_block: { after: { consumer_krw: 10_000, recommended_krw: 9_000, supply_krw: 5_000 } },
      },
    ]);
    expect(discount).toBe(Math.floor((list * 14) / 100) * 2);
  });
});
