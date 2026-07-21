import { describe, expect, it } from "vitest";
import {
  formatSimplyurPerDayFromTotal,
  formatSimplyurPriceFromKrw,
  krwToDisplayAmount,
  shouldShowSimplyurPerDay,
  type SimplyurFxRates,
} from "@/lib/simplyur/currency";

const TEST_RATES: SimplyurFxRates = {
  USD: 1000,
  JPY: 10,
  CNY: 200,
  TWD: 40,
  VND: 0.05,
};

describe("krwToDisplayAmount", () => {
  it("converts KRW to USD", () => {
    expect(krwToDisplayAmount(11000, "USD", TEST_RATES)).toBe(11);
  });

  it("ceil for JPY", () => {
    expect(krwToDisplayAmount(11001, "JPY", TEST_RATES)).toBe(1101);
  });
});

describe("formatSimplyurPriceFromKrw", () => {
  it("formats en locale as USD", () => {
    const r = formatSimplyurPriceFromKrw(11000, "en", TEST_RATES);
    expect(r.currency).toBe("USD");
    expect(r.amount).toBe(11);
    expect(r.krw).toBe(11000);
  });
});

describe("formatSimplyurPerDayFromTotal", () => {
  it("returns null for invalid days", () => {
    expect(formatSimplyurPerDayFromTotal(10, 0, "USD", "en")).toBeNull();
  });

  it("rounds USD per-day to cents", () => {
    expect(formatSimplyurPerDayFromTotal(10, 3, "USD", "en")?.amount).toBe(3.33);
  });

  it("shows daily price only for plans of at least two days", () => {
    expect(shouldShowSimplyurPerDay(1)).toBe(false);
    expect(shouldShowSimplyurPerDay(2)).toBe(true);
    expect(shouldShowSimplyurPerDay(null)).toBe(false);
  });
});
