/**
 * 여행자 인증(CMLink) 대상 목적지 SSOT.
 * Usimsa: ICCID가 8985234… 로 시작하는 상품만 인증. 그 외 ICCID는 불필요.
 * 해당 ICCID가 나오는 목적지 = 홍콩·마카오·대만. 중국 본토 단독은 해당 없음.
 *
 * REGRESSION-FREEZE[bongsim-traveler-verification-hk-mo-tw]: manifest
 */
import { getPlanCoveredCountries } from "@/lib/bongsim/plan-coverage-map";

export const TRAVELER_VERIFICATION_DESTINATION_CODES = ["hk", "mo", "tw"] as const;

/** 권역 패키지 — HK/MO 포함 시 플래그 기반 안내 유지 (중국 단독 칩과는 별개) */
export const TRAVELER_VERIFICATION_REGION_PACK_CODES = ["rg-hk-mo", "rg-cn-hk-mo"] as const;

export function isTravelerVerificationDestinationCode(code: string): boolean {
  const c = String(code ?? "")
    .trim()
    .toLowerCase();
  return (TRAVELER_VERIFICATION_DESTINATION_CODES as readonly string[]).includes(c);
}

/** 국가/권역 카탈로그 chip·안내 — 중국(cn) 등 비대상 코드는 항상 none */
export function countryCatalogAllowsTravelerVerificationPolicy(code: string): boolean {
  const c = String(code ?? "")
    .trim()
    .toLowerCase();
  if (isTravelerVerificationDestinationCode(c)) return true;
  return (TRAVELER_VERIFICATION_REGION_PACK_CODES as readonly string[]).includes(c);
}

/** 중국 본토 단독 플랜 — 공급사 flags.kyc=O 여도 여행자 인증 불필요 */
export function isChinaMainlandOnlyPlanExemptFromTravelerVerification(
  planName: string | null | undefined,
): boolean {
  const name = String(planName ?? "").trim();
  if (!name) return false;
  if (name === "중국") return true;
  const covered = getPlanCoveredCountries(name);
  return covered.length === 1 && covered[0] === "cn";
}
