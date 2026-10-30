import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** REGRESSION-FREEZE[bongsim-esim-hide-unavailable]: 「없음」 표기 회귀 방지 소스 가드 */
const root = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

describe("bongsim-esim-hide-unavailable source guard", () => {
  it("플랜 팝업 — 0건 유형 탭/열은 숨김, 「이 유형의 플랜이 없습니다」 금지", () => {
    const src = read("components/bongsim/recommend/PlanSelectPopup.tsx");
    expect(src).toContain("planTabsWithSellablePlans(ALL_PLAN_TABS, tabCounts)");
    expect(src).toContain("desktopPlanTabs");
    expect(src).not.toContain("이 유형의 플랜이 없습니다");
    expect(src).not.toMatch(/\{ALL_PLAN_TABS\.map\(/);
  });

  it("middleware — 상품·국가 판매 불가 → 404 훅 + matcher", () => {
    const src = read("middleware.ts");
    expect(src).toContain("esimUnavailableNotFoundResponse");
    expect(src).toContain("'/travel/esim/product/:path*'");
  });

  it("홈·랜딩 목적지 타일 — 판매 필터", () => {
    expect(read("components/bongsim/HomeDestinationGrid.tsx")).toContain("filterSellableDestinations");
    expect(read("app/components/home/HomeEsimProductSection.tsx")).toContain("limit={HOME_ESIM_LIMIT}");
  });
});
