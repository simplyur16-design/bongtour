export type KycLabelState = "required" | "not_required" | "unknown";

function normalizeKycRaw(raw: string | null | undefined): string {
  if (raw == null) return "";
  return String(raw).trim().toUpperCase();
}

function kycRawToState(normalized: string): KycLabelState {
  if (normalized === "O") return "required";
  if (normalized === "X") return "not_required";
  return "unknown";
}

export function getKycLabelState(flags: Record<string, unknown> | null | undefined): KycLabelState {
  const kyc = flags?.kyc;
  const raw = typeof kyc === "string" ? kyc : kyc != null ? String(kyc) : "";
  return kycRawToState(normalizeKycRaw(raw));
}

export function getKycLabelStateFromRaw(kycRaw: string | null | undefined): KycLabelState {
  return kycRawToState(normalizeKycRaw(kycRaw));
}
