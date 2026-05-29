export type KycLabelState = "required" | "not_required" | "unknown";

export type KycLabelDistribution = "binary" | "required_only" | "not_required_only" | "none";

export type KycProductFlags = { flags?: Record<string, unknown> | null };

function normalizeKycRaw(raw: string | null | undefined): string {
  if (raw == null) return "";
  return String(raw).trim().toUpperCase();
}

function kycRawToState(normalized: string): KycLabelState {
  if (normalized === "O") return "required";
  if (normalized === "X") return "not_required";
  return "unknown";
}

/** @deprecated 단일 상품 raw 판별 — 배지는 `shouldShowBadge` + 분포 SSOT 사용 */
export function getKycLabelState(flags: Record<string, unknown> | null | undefined): KycLabelState {
  const kyc = flags?.kyc;
  const raw = typeof kyc === "string" ? kyc : kyc != null ? String(kyc) : "";
  return kycRawToState(normalizeKycRaw(raw));
}

/** @deprecated 단일 상품 raw 판별 — 배지는 `shouldShowBadge` + 분포 SSOT 사용 */
export function getKycLabelStateFromRaw(kycRaw: string | null | undefined): KycLabelState {
  return kycRawToState(normalizeKycRaw(kycRaw));
}

export function getKycLabelDistribution(products: KycProductFlags[]): KycLabelDistribution {
  let hasRequired = false;
  let hasNotRequired = false;
  for (const item of products) {
    const state = getKycLabelState(item.flags);
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
  const state = getKycLabelState(product.flags);
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
