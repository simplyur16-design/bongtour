import { describe, expect, it } from "vitest";
import { parseRecommendCountryQuery } from "@/lib/bongsim/recommend/parse-recommend-entry-query";

// REGRESSION-FREEZE[bongsim-recommend-country-unlimited-first]: 홈 ?country= 파싱 — manifest

describe("parseRecommendCountryQuery", () => {
  it("reads ISO2 from query string", () => {
    expect(parseRecommendCountryQuery("?country=jp")).toBe("jp");
    expect(parseRecommendCountryQuery("country=VN&fromCheckout=1")).toBe("vn");
  });

  it("reads region pack codes", () => {
    expect(parseRecommendCountryQuery("?country=rg-eu-42")).toBe("rg-eu-42");
  });

  it("rejects missing or malformed codes", () => {
    expect(parseRecommendCountryQuery("")).toBeNull();
    expect(parseRecommendCountryQuery("?fromCheckout=1")).toBeNull();
    expect(parseRecommendCountryQuery("?country=")).toBeNull();
    expect(parseRecommendCountryQuery("?country=japan")).toBeNull();
    expect(parseRecommendCountryQuery("?country=../jp")).toBeNull();
  });
});
