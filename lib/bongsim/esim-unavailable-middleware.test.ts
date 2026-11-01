import { describe, expect, it } from "vitest";
import { esimSellableCheckOrigin, esimSellableQueryForRequest } from "@/lib/bongsim/esim-unavailable-middleware";
import { readFileSync } from "node:fs";

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

  it("판정 origin: 같은 프로세스 http://127.0.0.1:$PORT (프록시 https·localhost 아님), env override 우선", () => {
    expect(esimSellableCheckOrigin(undefined, "8080")).toBe("http://127.0.0.1:8080");
    expect(esimSellableCheckOrigin("", undefined)).toBe("http://127.0.0.1:3000");
    expect(esimSellableCheckOrigin("  ", "abc")).toBe("http://127.0.0.1:3000");
    expect(esimSellableCheckOrigin("https://bongtour.com/", "8080")).toBe("https://bongtour.com");
    expect(esimSellableCheckOrigin("not a url", "8080")).toBe("http://127.0.0.1:8080");
  });

  it("req.nextUrl.origin 으로 자기 호출하지 않음 (Railway 뒤 https://localhost 실패 회귀 방지)", () => {
    const src = readFileSync("lib/bongsim/esim-unavailable-middleware.ts", "utf8");
    expect(src).not.toMatch(/return[^\n]*req\.nextUrl\.origin/);
    expect(src).toContain("http://127.0.0.1:");
  });
});
