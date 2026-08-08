/** Mirror lib/simplyur/checkout/session-buyer-email normalize — keep app bundle light. */
export function normalizeSimplyurBuyerEmail(raw: string | null | undefined): string {
  const v = (raw ?? '').trim();
  if (!v || !v.includes('@')) return '';
  return v.slice(0, 254);
}
