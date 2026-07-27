import { describe, expect, it } from "vitest";
import {
  PRODUCTS_BY_COUNTRY_CLIENT_TIMEOUT_MS,
} from "@/lib/bongsim/recommend/prefetch-products-by-country";
import { normalizeProductsByCountryKey } from "@/lib/bongsim/recommend/products-by-country-client-key";

// REGRESSION-FREEZE[bongsim-by-country-slim-prefetch]: 국가 타일 hover prefetch — manifest

describe("normalizeProductsByCountryKey", () => {
  it("정렬·소문자 정규화", () => {
    expect(normalizeProductsByCountryKey(["KR", "jp"])).toBe("jp,kr");
    expect(normalizeProductsByCountryKey(["jp"])).toBe("jp");
  });
});

describe("PRODUCTS_BY_COUNTRY_CLIENT_TIMEOUT_MS", () => {
  it("클라이언트 타임아웃이 정의되어 무한 로딩을 막는다", () => {
    expect(PRODUCTS_BY_COUNTRY_CLIENT_TIMEOUT_MS).toBeGreaterThanOrEqual(10_000);
    expect(PRODUCTS_BY_COUNTRY_CLIENT_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
  });
});
