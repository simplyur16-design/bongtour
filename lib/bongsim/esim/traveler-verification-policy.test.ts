/**
 * REGRESSION-FREEZE[bongsim-traveler-verification-hk-mo-tw]
 */
import { describe, expect, it } from "vitest";
import {
  countryCatalogAllowsTravelerVerificationPolicy,
  isChinaMainlandOnlyPlanExemptFromTravelerVerification,
  isTravelerVerificationDestinationCode,
} from "@/lib/bongsim/esim/traveler-verification-policy";
import { getKycLabelDistribution, shouldShowBadge } from "@/lib/bongsim/esim/kyc-required";

describe("traveler verification destination SSOT", () => {
  it("홍콩·마카오·대만만 destination 대상", () => {
    expect(isTravelerVerificationDestinationCode("hk")).toBe(true);
    expect(isTravelerVerificationDestinationCode("mo")).toBe(true);
    expect(isTravelerVerificationDestinationCode("tw")).toBe(true);
    expect(isTravelerVerificationDestinationCode("cn")).toBe(false);
    expect(isTravelerVerificationDestinationCode("jp")).toBe(false);
  });

  it("중국(cn) 카탈로그 정책 비허용 — 권역 rg-hk-mo / rg-cn-hk-mo 는 허용", () => {
    expect(countryCatalogAllowsTravelerVerificationPolicy("cn")).toBe(false);
    expect(countryCatalogAllowsTravelerVerificationPolicy("hk")).toBe(true);
    expect(countryCatalogAllowsTravelerVerificationPolicy("rg-hk-mo")).toBe(true);
    expect(countryCatalogAllowsTravelerVerificationPolicy("rg-cn-hk-mo")).toBe(true);
  });

  it("중국 본토 단독 플랜은 KYC O여도 인증 불필요", () => {
    expect(isChinaMainlandOnlyPlanExemptFromTravelerVerification("중국")).toBe(true);
    expect(isChinaMainlandOnlyPlanExemptFromTravelerVerification("중국/홍콩/마카오")).toBe(false);
    expect(isChinaMainlandOnlyPlanExemptFromTravelerVerification("대만")).toBe(false);

    const chinaO = { plan_name: "중국", flags: { kyc: "O" } };
    expect(getKycLabelDistribution([chinaO])).toBe("not_required_only");
    expect(shouldShowBadge(chinaO, "not_required_only")).toBeNull();

    const twO = { plan_name: "대만", flags: { kyc: "O" } };
    expect(getKycLabelDistribution([twO])).toBe("required_only");
    expect(shouldShowBadge(twO, "required_only")).toBe("required");
  });
});
