import { isChinaMainlandOnlyPlanExemptFromTravelerVerification } from "@/lib/bongsim/esim/traveler-verification-policy";

export type KycLabelState = "required" | "not_required" | "unknown";

export type KycLabelDistribution = "binary" | "required_only" | "not_required_only" | "none";

export type KycProductFlags = {
  flags?: Record<string, unknown> | null;
  /** plan_name 있으면 중국 본토 단독 KYC 면제 SSOT 적용 */
  plan_name?: string | null;
};

function normalizeKycRaw(raw: string | null | undefined): string {
  if (raw == null) return "";
  return String(raw).trim().toUpperCase();
}

function kycRawToState(normalized: string): KycLabelState {
  if (normalized === "O") return "required";
  if (normalized === "X") return "not_required";
  return "unknown";
}

/** flags.kyc raw 판별 (중국 단독 면제 없음) */
export function getKycLabelState(flags: Record<string, unknown> | null | undefined): KycLabelState {
  const kyc = flags?.kyc;
  const raw = typeof kyc === "string" ? kyc : kyc != null ? String(kyc) : "";
  return kycRawToState(normalizeKycRaw(raw));
}

export function getKycLabelStateFromRaw(kycRaw: string | null | undefined): KycLabelState {
  return kycRawToState(normalizeKycRaw(kycRaw));
}

/** UI·분포 SSOT — 중국 본토 단독은 공급사 O여도 not_required */
export function getEffectiveKycLabelState(product: KycProductFlags): KycLabelState {
  if (isChinaMainlandOnlyPlanExemptFromTravelerVerification(product.plan_name)) {
    return "not_required";
  }
  return getKycLabelState(product.flags);
}

export function getKycLabelDistribution(products: KycProductFlags[]): KycLabelDistribution {
  let hasRequired = false;
  let hasNotRequired = false;
  for (const item of products) {
    const state = getEffectiveKycLabelState(item);
    if (state === "required") hasRequired = true;
    else if (state === "not_required") hasNotRequired = true;
  }
  if (hasRequired && hasNotRequired) return "binary";
  if (hasRequired) return "required_only";
  if (hasNotRequired) return "not_required_only";
  return "none";
}

export function hasBinaryAuthDistribution(products: KycProductFlags[]): boolean {
  return getKycLabelDistribution(products) === "binary";
}

export type KycBadgeState = "required" | "not_required" | null;

export function shouldShowBadge(
  product: KycProductFlags,
  distribution: KycLabelDistribution,
): KycBadgeState {
  const state = getEffectiveKycLabelState(product);
  switch (distribution) {
    case "binary":
      if (state === "required") return "required";
      if (state === "not_required") return "not_required";
      return null;
    case "required_only":
      if (state === "required") return "required";
      return null;
    case "not_required_only":
    case "none":
    default:
      return null;
  }
}
