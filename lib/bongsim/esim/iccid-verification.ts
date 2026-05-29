export const TRAVELER_VERIFICATION_ICCID_PREFIX = "8985234";

export const CMLINK_TRAVELER_VERIFICATION_URL = "https://global.cmlink.com/en/real-name";

export function requiresTravelerVerification(iccid: string | null | undefined): boolean {
  const trimmed = iccid?.trim();
  if (!trimmed) return false;
  return trimmed.startsWith(TRAVELER_VERIFICATION_ICCID_PREFIX);
}

export function extractIccidPostPrefix(iccid: string | null | undefined): string | null {
  const trimmed = iccid?.trim();
  if (!trimmed || !trimmed.startsWith(TRAVELER_VERIFICATION_ICCID_PREFIX)) return null;
  const post = trimmed.slice(TRAVELER_VERIFICATION_ICCID_PREFIX.length);
  return post.length > 0 ? post : null;
}

export function pickPrimaryVerificationIccid(
  topups: Array<{ iccid?: string | null }>,
): string | null {
  for (const topup of topups) {
    const iccid = topup.iccid?.trim();
    if (iccid && requiresTravelerVerification(iccid)) return iccid;
  }
  return null;
}
