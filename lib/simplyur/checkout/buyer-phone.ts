/** simplyur — phone required so Solapi can text the issued eSIM. */
// REGRESSION-FREEZE[simplyur-esim-solapi-sms]: phone required 8–15 digits — manifest
export function normalizeSimplyurBuyerPhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

export function isValidSimplyurBuyerPhoneInput(raw: string): boolean {
  return normalizeSimplyurBuyerPhone(raw) != null;
}
