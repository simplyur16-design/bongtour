/** simplyur — phone optional. Email carries the QR. Solapi LMS only if a Korea mobile is given. */
// REGRESSION-FREEZE[simplyur-esim-solapi-sms]: phone optional 8–15 digits — manifest
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

/**
 * Solapi LMS is Korea domestic. Foreign visitor numbers must not take the SMS path
 * (failed overseas SMS currently blocks the QR email).
 */
// REGRESSION-FREEZE[simplyur-eximbay-refund-inbound-usimsa]: KR mobile only for LMS — manifest
export function isSimplyurKoreaMobileForLms(raw: string | null | undefined): boolean {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return false;
  let n = digits;
  if (n.startsWith("82")) n = n.slice(2);
  if (n.startsWith("0")) {
    return /^010\d{7,8}$/.test(n);
  }
  return /^10\d{7,8}$/.test(n);
}
