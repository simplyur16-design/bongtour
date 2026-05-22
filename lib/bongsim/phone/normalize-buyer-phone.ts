/** 국내 휴대폰 — 숫자만 10~11자리 (010…) */
export function normalizeBuyerPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 11) return null;
  if (!digits.startsWith("01")) return null;
  return digits;
}

export function isValidBuyerPhoneInput(raw: string): boolean {
  return normalizeBuyerPhone(raw) != null;
}
