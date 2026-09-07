/**
 * REGRESSION-FREEZE[schedule-poi-porto-europa-osaka]: 포르투 유럽 ≠ Clerigos / bare 유럽 — manifest
 */
import { describe, expect, it } from "vitest";
import { mapKoreanPoiSegment } from "@/lib/pexels-keyword";
import { firstMatchingScheduleSpotEn } from "@/lib/schedule-poi-regex-ssot";
import {
  EUROPE_PRODUCT_DEST_RE,
  inferRegisterEffectiveProductDestination,
} from "@/lib/register-schedule-cross-continent-keyword-guard";

describe("schedule-poi-porto-europa-osaka", () => {
  it("maps 포르투 유럽 to Osaka theme park, not Clerigos", () => {
    expect(firstMatchingScheduleSpotEn("포르투 유럽")).toMatch(/Porto Europa Osaka/i);
    expect(firstMatchingScheduleSpotEn("Porto Europa")).toMatch(/Porto Europa Osaka/i);
    expect(mapKoreanPoiSegment("포르투 유럽")).toMatch(/Porto Europa Osaka/i);
    expect(firstMatchingScheduleSpotEn("포르투 유럽")).not.toMatch(/Clerigos/i);
  });

  it("keeps bare 포르투 as Portugal Clerigos", () => {
    expect(firstMatchingScheduleSpotEn("포르투")).toMatch(/Clerigos Tower Porto/i);
  });

  it("does not treat 포르투 유럽 as Europe continent hay", () => {
    expect(EUROPE_PRODUCT_DEST_RE.test("포르투 유럽")).toBe(false);
    expect(EUROPE_PRODUCT_DEST_RE.test("서유럽")).toBe(true);
    const dest = inferRegisterEffectiveProductDestination("오사카", [
      {
        routeText: "와카야마 - 오사카 - 타마 열차 - 포르투 유럽 - 쿠로시오시장",
        title: null,
        description: null,
      },
    ]);
    expect(dest).toMatch(/오사카|Osaka|일본|Japan|Asia/i);
  });
});
