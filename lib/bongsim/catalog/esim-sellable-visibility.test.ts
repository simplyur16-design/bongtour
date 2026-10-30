import { describe, expect, it } from "vitest";
import {
  esimProductOptionIdFromPath,
  filterSellableDestinations,
  isWellFormedOptionApiId,
  normalizeEsimDestinationCode,
  packHasSellablePlans,
  planGridColsClass,
  planTabsWithSellablePlans,
} from "@/lib/bongsim/catalog/esim-sellable-visibility";

describe("esim-sellable-visibility (REGRESSION-FREEZE[bongsim-esim-hide-unavailable])", () => {
  it("상품 경로에서 option id 추출", () => {
    expect(esimProductOptionIdFromPath("/travel/esim/product/63FB5DC6-3002-F111-832E-6045BD44FE0E")).toBe(
      "63FB5DC6-3002-F111-832E-6045BD44FE0E",
    );
    expect(esimProductOptionIdFromPath("/travel/esim/product/abc/")).toBe("abc");
    expect(esimProductOptionIdFromPath("/travel/esim/product/")).toBeNull();
    expect(esimProductOptionIdFromPath("/travel/esim/product/a/b")).toBeNull();
    expect(esimProductOptionIdFromPath("/travel/esim/catalog")).toBeNull();
  });

  it("형식이 깨진 option id는 존재 불가", () => {
    expect(isWellFormedOptionApiId("63FB5DC6-3002-F111-832E-6045BD44FE0E")).toBe(true);
    expect(isWellFormedOptionApiId("<script>")).toBe(false);
    expect(isWellFormedOptionApiId("a".repeat(200))).toBe(false);
  });

  it("목적지 코드 정규화 — ISO2·rg-* 만", () => {
    expect(normalizeEsimDestinationCode(" JP ")).toBe("jp");
    expect(normalizeEsimDestinationCode("rg-eu-42")).toBe("rg-eu-42");
    expect(normalizeEsimDestinationCode("japan")).toBeNull();
    expect(normalizeEsimDestinationCode(null)).toBeNull();
  });

  it("pack 판매 플랜 유무", () => {
    expect(packHasSellablePlans(null)).toBe(false);
    expect(packHasSellablePlans({ roaming: { products: [] }, local: null })).toBe(false);
    expect(packHasSellablePlans({ roaming: { products: [] }, local: { products: [{}] } })).toBe(true);
    expect(packHasSellablePlans({ roaming: { products: [{}] }, local: null })).toBe(true);
  });

  it("판매 불가 목적지는 목록에서 제거 — 없음 표기 대신 숨김", () => {
    const items = [{ code: "jp" }, { code: "RU" }, { code: "rg-eu-42" }];
    expect(filterSellableDestinations(items, new Set(["jp", "rg-eu-42"])).map((i) => i.code)).toEqual([
      "jp",
      "rg-eu-42",
    ]);
  });

  it("판매 목록을 못 불러오면(null) 기존 목록 유지 — fail-open", () => {
    const items = [{ code: "jp" }, { code: "th" }];
    expect(filterSellableDestinations(items, null)).toEqual(items);
  });

  it("0건 플랜 유형 탭은 숨김", () => {
    expect(
      planTabsWithSellablePlans(["unlimited", "daily", "fixed"] as const, { unlimited: 3, daily: 0, fixed: 2 }),
    ).toEqual(["unlimited", "fixed"]);
    expect(planGridColsClass(1)).toBe("grid-cols-1");
    expect(planGridColsClass(2)).toBe("grid-cols-2");
    expect(planGridColsClass(3)).toBe("grid-cols-3");
  });
});
