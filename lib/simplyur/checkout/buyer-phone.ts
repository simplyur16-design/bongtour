/** simplyur — international travelers; phone optional (email is primary). */
export function normalizeSimplyurBuyerPhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

export function isValidSimplyurBuyerPhoneInput(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return true;
  return normalizeSimplyurBuyerPhone(trimmed) != null;
}
