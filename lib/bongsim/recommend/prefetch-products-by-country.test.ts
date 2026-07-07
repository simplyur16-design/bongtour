import { describe, expect, it } from "vitest";
import { normalizeProductsByCountryKey } from "@/lib/bongsim/recommend/products-by-country-client-key";

describe("normalizeProductsByCountryKey", () => {
  it("정렬·소문자 정규화", () => {
    expect(normalizeProductsByCountryKey(["KR", "jp"])).toBe("jp,kr");
    expect(normalizeProductsByCountryKey(["jp"])).toBe("jp");
  });
});
