import { describe, expect, it } from "vitest";
import {
  SIMPLYUR_FTC_BIZ_VERIFY_HREF,
  SIMPLYUR_LEGAL_ENTITY,
  simplyurLegalPath,
} from "@/lib/simplyur/legal-disclosures";

describe("simplyur legal disclosures", () => {
  it("PG 심사용 약관·개인정보·환불 경로", () => {
    expect(simplyurLegalPath("en", "terms")).toBe("/simplyur/en/legal/terms");
    expect(simplyurLegalPath("en", "privacy")).toBe("/simplyur/en/legal/privacy");
    expect(simplyurLegalPath("en", "refund")).toBe("/simplyur/en/legal/refund");
  });

  it("사업자등록번호·대표자·FTC 링크", () => {
    expect(SIMPLYUR_LEGAL_ENTITY.bizRegNo).toBe("255-81-03455");
    expect(SIMPLYUR_LEGAL_ENTITY.representativeName).toBe("황일연");
    expect(SIMPLYUR_FTC_BIZ_VERIFY_HREF).toContain("2558103455");
  });

  it("simplyur 표시 주소는 영문", () => {
    expect(SIMPLYUR_LEGAL_ENTITY.addressEn).toMatch(/Republic of Korea/);
    expect(SIMPLYUR_LEGAL_ENTITY.addressEn).toMatch(/Edutown-ro/);
    expect(SIMPLYUR_LEGAL_ENTITY.addressEn).not.toMatch(/경기도/);
  });
});
