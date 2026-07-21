import { describe, expect, it, afterEach } from "vitest";
import {
  isSimplyurFxRateInBand,
  parseExchangeRateApiUsdBaseToKrwPerUnit,
  setSimplyurFxLastGoodRatesForTests,
  SIMPLYUR_FX_REVALIDATE_SEC,
} from "@/lib/simplyur/fx-rates";
import {
  formatSimplyurPerDayFromTotal,
  getSimplyurFxRates,
  krwToDisplayAmount,
} from "@/lib/simplyur/currency";
import { krwOrderTotalToUsdMinor } from "@/lib/simplyur/payments/portone-methods";
import { SIMPLYUR_MARKUP_MULTIPLIER, simplyurSellPriceKrw } from "@/lib/simplyur/pricing";

// REGRESSION-FREEZE[simplyur-fx-daily-price]: vitest SSOT — manifest

describe("simplyur fx + daily price", () => {
  afterEach(() => {
    setSimplyurFxLastGoodRatesForTests(null);
  });

  it("caches FX for 12 hours", () => {
    expect(SIMPLYUR_FX_REVALIDATE_SEC).toBe(12 * 60 * 60);
  });

  it("parses ExchangeRate-API USD base into KRW-per-unit rates", () => {
    const rates = parseExchangeRateApiUsdBaseToKrwPerUnit({
      result: "success",
      base_code: "USD",
      conversion_rates: {
        USD: 1,
        KRW: 1400,
        JPY: 150,
        CNY: 7.2,
        TWD: 32,
        VND: 25_000,
      },
    });
    expect(rates).not.toBeNull();
    expect(rates!.USD).toBe(1400);
    expect(rates!.JPY).toBeCloseTo(1400 / 150, 6);
    expect(rates!.CNY).toBeCloseTo(1400 / 7.2, 6);
    expect(rates!.TWD).toBeCloseTo(1400 / 32, 6);
    expect(rates!.VND).toBeCloseTo(1400 / 25_000, 8);
    expect(isSimplyurFxRateInBand("USD", rates!.USD)).toBe(true);
  });

  it("rejects out-of-band or incomplete API payloads", () => {
    expect(
      parseExchangeRateApiUsdBaseToKrwPerUnit({
        result: "success",
        conversion_rates: { USD: 1, KRW: 500, JPY: 150, CNY: 7, TWD: 32, VND: 25000 },
      }),
    ).toBeNull();
    expect(
      parseExchangeRateApiUsdBaseToKrwPerUnit({
        result: "error",
        conversion_rates: { USD: 1, KRW: 1400, JPY: 150, CNY: 7, TWD: 32, VND: 25000 },
      }),
    ).toBeNull();
  });

  it("applies 5% markup on after.consumer_krw", () => {
    expect(SIMPLYUR_MARKUP_MULTIPLIER).toBe(1.05);
    expect(
      simplyurSellPriceKrw({
        after: { consumer_krw: 10000, recommended_krw: 12000 },
      }),
    ).toBe(Math.ceil(10000 * 1.05));
  });

  it("formats per-day display from package total", () => {
    const per = formatSimplyurPerDayFromTotal(26.07, 7, "USD", "en");
    expect(per).not.toBeNull();
    expect(per!.amount).toBe(3.72);
    expect(per!.formatted).toContain("3.72");

    const jpy = formatSimplyurPerDayFromTotal(3500, 7, "JPY", "ja");
    expect(jpy!.amount).toBe(500);
  });

  it("keeps display USD and PortOne USD minor aligned for a snapshot", () => {
    const rates = {
      USD: 1400,
      JPY: 9.5,
      CNY: 190,
      TWD: 45,
      VND: 0.055,
    };
    const sellKrw = Math.ceil(10000 * SIMPLYUR_MARKUP_MULTIPLIER);
    const usd = krwToDisplayAmount(sellKrw, "USD", rates);
    const minor = krwOrderTotalToUsdMinor(sellKrw, rates);
    expect(minor).toBe(Math.max(1, Math.round(usd * 100)));
  });

  it("falls back to env/default rates when sync helper used", () => {
    const fallback = getSimplyurFxRates();
    expect(fallback.USD).toBeGreaterThan(0);
    expect(krwOrderTotalToUsdMinor(fallback.USD)).toBe(100);
  });
});
