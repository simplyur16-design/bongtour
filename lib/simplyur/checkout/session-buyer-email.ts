/**
 * Prefill simplyur checkout buyer email from Auth.js session and/or app handoff query.
 * Guest checkout stays blank; signed-in Google/Apple/email users should not re-type.
 * REGRESSION-FREEZE[simplyur-checkout-session-email-prefill]: session email prefill — manifest
 */
export function normalizeSimplyurBuyerEmail(raw: string | null | undefined): string {
  const v = (raw ?? '').trim()
  if (!v || !v.includes('@')) return ''
  return v.slice(0, 254)
}

/** Session wins; else app `buyerEmail` query (RN WebBrowser has no Auth cookie jar). */
export function resolveSimplyurCheckoutBuyerEmail(args: {
  sessionEmail?: string | null
  queryBuyerEmail?: string | null
}): string {
  return (
    normalizeSimplyurBuyerEmail(args.sessionEmail) ||
    normalizeSimplyurBuyerEmail(args.queryBuyerEmail) ||
    ''
  )
}

/** Deep-link query for simplyur://oauth-complete?email= */
export function simplyurOAuthCompleteEmailQuery(email: string | null | undefined): string {
  const e = normalizeSimplyurBuyerEmail(email)
  return e ? `&email=${encodeURIComponent(e)}` : ''
}
