import { describe, expect, it } from "vitest";
import {
  BONGSIM_PRICE_EFFECTIVE_FROM_20260901,
  resolveBongsimPriceEffectiveFrom,
  isBeforePriceEffectiveWindow,
  isPriceBlockCatalogSellable,
  isScheduledNewSkuHiddenUntilCutover,
  resolveActivePriceSide,
} from "@/lib/bongsim/data/pricing-effective-from";
import { BONGSIM_CATALOG_NOT_SCHEDULED_NEW_SKU_WHERE } from "@/lib/bongsim/data/catalog-consumer-krw-sql";

// REGRESSION-FREEZE[bongsim-price-effective-from]: Sept 1 00:00 KST — manifest

describe("pricing-effective-from", () => {
  const block = {
    before: { consumer_krw: 9000, recommended_krw: null, supply_krw: 5000 },
    after: { consumer_krw: 11000, recommended_krw: null, supply_krw: 6000 },
    effective_from: BONGSIM_PRICE_EFFECTIVE_FROM_20260901,
  };

  it("locks cutover at 2026-09-01 00:00 KST", () => {
    expect(BONGSIM_PRICE_EFFECTIVE_FROM_20260901).toBe("2026-09-01T00:00:00+09:00");
    expect(Date.parse(BONGSIM_PRICE_EFFECTIVE_FROM_20260901)).toBe(Date.parse("2026-08-31T15:00:00.000Z"));
    expect(resolveBongsimPriceEffectiveFrom()).toBe(BONGSIM_PRICE_EFFECTIVE_FROM_20260901);
  });

  it("BONGSIM_PRICE_EFFECTIVE_FROM can open the Sept 1 book early", () => {
    const prev = process.env.BONGSIM_PRICE_EFFECTIVE_FROM;
    process.env.BONGSIM_PRICE_EFFECTIVE_FROM = "2026-08-31T00:00:00+09:00";
    try {
      expect(resolveBongsimPriceEffectiveFrom()).toBe("2026-08-31T00:00:00+09:00");
      expect(isScheduledNewSkuHiddenUntilCutover("신규 상품", Date.parse("2026-08-31T12:00:00+09:00"))).toBe(
        false,
      );
    } finally {
      if (prev === undefined) delete process.env.BONGSIM_PRICE_EFFECTIVE_FROM;
      else process.env.BONGSIM_PRICE_EFFECTIVE_FROM = prev;
    }
  });

  it("uses before before cutover and after after cutover", () => {
    const beforeMs = Date.parse(BONGSIM_PRICE_EFFECTIVE_FROM_20260901) - 1;
    const afterMs = Date.parse(BONGSIM_PRICE_EFFECTIVE_FROM_20260901);
    expect(isBeforePriceEffectiveWindow(block, beforeMs)).toBe(true);
    expect(resolveActivePriceSide(block, beforeMs).consumer_krw).toBe(9000);
    expect(isBeforePriceEffectiveWindow(block, afterMs)).toBe(false);
    expect(resolveActivePriceSide(block, afterMs).consumer_krw).toBe(11000);
  });

  it("accepts ProductOption-like unknown price fields (Railway tsc)", () => {
    const loose = {
      before: { recommended_krw: "9000" as unknown, consumer_krw: undefined as unknown, supply_krw: 5000 as unknown },
      after: { recommended_krw: null as unknown, consumer_krw: "11000" as unknown, supply_krw: "6000" as unknown },
      effective_from: BONGSIM_PRICE_EFFECTIVE_FROM_20260901,
    };
    const afterMs = Date.parse(BONGSIM_PRICE_EFFECTIVE_FROM_20260901);
    expect(resolveActivePriceSide(loose, afterMs).consumer_krw).toBe(11000);
    expect(resolveActivePriceSide(loose, afterMs).supply_krw).toBe(6000);
  });

  it("hides after-only scheduled SKUs until cutover (no after fallback)", () => {
    const scheduled = {
      before: { consumer_krw: null, recommended_krw: null, supply_krw: null },
      after: { consumer_krw: 12000, recommended_krw: null, supply_krw: 7000 },
      effective_from: BONGSIM_PRICE_EFFECTIVE_FROM_20260901,
    };
    const beforeMs = Date.parse(BONGSIM_PRICE_EFFECTIVE_FROM_20260901) - 1;
    const afterMs = Date.parse(BONGSIM_PRICE_EFFECTIVE_FROM_20260901);
    expect(resolveActivePriceSide(scheduled, beforeMs).consumer_krw).toBeNull();
    expect(isPriceBlockCatalogSellable(scheduled, beforeMs)).toBe(false);
    expect(resolveActivePriceSide(scheduled, afterMs).consumer_krw).toBe(12000);
    expect(isPriceBlockCatalogSellable(scheduled, afterMs)).toBe(true);
  });

  it("SQL catalog gate excludes 신규 상품 before the Sept 1 stamp", () => {
    expect(BONGSIM_CATALOG_NOT_SCHEDULED_NEW_SKU_WHERE).toContain("신규 상품");
    expect(BONGSIM_CATALOG_NOT_SCHEDULED_NEW_SKU_WHERE).toContain(BONGSIM_PRICE_EFFECTIVE_FROM_20260901);
    expect(BONGSIM_CATALOG_NOT_SCHEDULED_NEW_SKU_WHERE).not.toContain("상품 확장");
  });

  it("does not fall back to 20260316 before after the Aug 31 23:59 cutoff", () => {
    const retired = {
      before: { consumer_krw: 9000, recommended_krw: 8000, supply_krw: 5000 },
      after: { consumer_krw: null, recommended_krw: null, supply_krw: null },
      effective_from: BONGSIM_PRICE_EFFECTIVE_FROM_20260901,
    };
    const beforeMs = Date.parse(BONGSIM_PRICE_EFFECTIVE_FROM_20260901) - 1;
    const afterMs = Date.parse(BONGSIM_PRICE_EFFECTIVE_FROM_20260901);
    expect(resolveActivePriceSide(retired, beforeMs).supply_krw).toBe(5000);
    expect(isPriceBlockCatalogSellable(retired, beforeMs)).toBe(true);
    expect(resolveActivePriceSide(retired, afterMs).supply_krw).toBeNull();
    expect(isPriceBlockCatalogSellable(retired, afterMs)).toBe(false);
  });

  it("hides excel 신규 상품 until Sept 1 00:00 KST", () => {
    const beforeMs = Date.parse(BONGSIM_PRICE_EFFECTIVE_FROM_20260901) - 1;
    const afterMs = Date.parse(BONGSIM_PRICE_EFFECTIVE_FROM_20260901);
    expect(isScheduledNewSkuHiddenUntilCutover("신규 상품", beforeMs)).toBe(true);
    expect(isScheduledNewSkuHiddenUntilCutover("신규 상품", afterMs)).toBe(false);
    expect(isScheduledNewSkuHiddenUntilCutover("상품 확장", beforeMs)).toBe(false);
  });
});
