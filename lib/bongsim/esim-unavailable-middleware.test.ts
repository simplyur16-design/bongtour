import { describe, expect, it } from "vitest";
import { esimSellableQueryForRequest } from "@/lib/bongsim/esim-unavailable-middleware";

const q = (s: string) => new URLSearchParams(s);

describe("esim-unavailable-middleware (REGRESSION-FREEZE[bongsim-esim-hide-unavailable])", () => {
  it("상품 상세 → option 판정", () => {
    expect(esimSellableQueryForRequest("/travel/esim/product/ABC-1", q(""))).toBe("option=ABC-1");
    expect(esimSellableQueryForRequest("/travel/esim/product/%3Cx%3E", q(""))).toBe("invalid");
  });

  it("recommend?country= → 국가 판정, 체크아웃 복귀·국가 없음은 대상 아님", () => {
    expect(esimSellableQueryForRequest("/travel/esim/recommend", q("country=JP"))).toBe("country=jp");
    expect(esimSellableQueryForRequest("/travel/esim/recommend", q("country=rg-eu-42"))).toBe(
      "country=rg-eu-42",
    );
    expect(esimSellableQueryForRequest("/travel/esim/recommend", q(""))).toBeNull();
    expect(esimSellableQueryForRequest("/travel/esim/recommend", q("fromCheckout=1&country=jp"))).toBeNull();
    expect(esimSellableQueryForRequest("/travel/esim/recommend", q("country=japan"))).toBeNull();
  });

  it("다른 경로·simplyur는 건드리지 않음", () => {
    expect(esimSellableQueryForRequest("/travel/esim/catalog", q("country=jp"))).toBeNull();
    expect(esimSellableQueryForRequest("/simplyur/ko/product/ABC", q(""))).toBeNull();
  });
});
