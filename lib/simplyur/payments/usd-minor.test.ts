import { describe, expect, it, vi } from "vitest";
import { getSimplyurFxRates, krwToDisplayAmount, type SimplyurFxRates } from "@/lib/simplyur/currency";
import { krwOrderTotalToUsdMinor, krwOrderTotalToUsdMinorResolved } from "@/lib/simplyur/payments/usd-minor";

/** Reference copy of the pre-move formula (portone-methods.ts @ 6164c86a) — must stay identical. */
function referenceUsdMinor(krw: number, rates?: SimplyurFxRates): number {
  if (!Number.isFinite(krw) || krw <= 0) return 1;
  const usd = krwToDisplayAmount(krw, "USD", rates ?? getSimplyurFxRates());
  return Math.max(1, Math.round(usd * 100));
}

const { RESOLVED_RATES } = vi.hoisted(() => ({
  RESOLVED_RATES: { USD: 1350.25, JPY: 9.1, CNY: 186, TWD: 43, VND: 0.053 },
}));

vi.mock("@/lib/simplyur/fx-rates", () => ({
  resolveSimplyurFxRates: vi.fn(async () => RESOLVED_RATES),
}));

const RATE_SETS: SimplyurFxRates[] = [
  { USD: 1400, JPY: 9.5, CNY: 190, TWD: 45, VND: 0.055 },
  { USD: 1350.25, JPY: 9.1, CNY: 186, TWD: 43, VND: 0.053 },
  { USD: 1487.6, JPY: 10.2, CNY: 201, TWD: 47, VND: 0.058 },
];
const KRW_TOTALS = [0, -100, Number.NaN, 1, 500, 1000, 3300, 9900, 10500, 12345, 27720, 55000, 99999, 150000, 1234567];

describe("simplyur usd-minor (moved from portone-methods)", () => {
  it("matches the reference formula for representative KRW totals and rate sets", () => {
    for (const rates of RATE_SETS) {
      for (const krw of KRW_TOTALS) {
        expect(krwOrderTotalToUsdMinor(krw, rates)).toBe(referenceUsdMinor(krw, rates));
      }
    }
  });

  it("matches the reference formula with fallback rates", () => {
    for (const krw of KRW_TOTALS) {
      expect(krwOrderTotalToUsdMinor(krw)).toBe(referenceUsdMinor(krw));
    }
  });

  it("pins known values at USD=1400", () => {
    const r = RATE_SETS[0];
    expect(krwOrderTotalToUsdMinor(0, r)).toBe(1);
    expect(krwOrderTotalToUsdMinor(14000, r)).toBe(1000);
    expect(krwOrderTotalToUsdMinor(10500, r)).toBe(referenceUsdMinor(10500, r));
  });

  it("resolved variant equals the reference formula on the resolved snapshot", async () => {
    for (const krw of KRW_TOTALS) {
      expect(await krwOrderTotalToUsdMinorResolved(krw)).toBe(referenceUsdMinor(krw, RESOLVED_RATES));
    }
  });
});
