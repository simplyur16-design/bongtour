import { normalizeSimplyurBuyerEmail } from '@/src/lib/normalize-buyer-email';

/** In-memory — set from oauth-complete deep link; used when opening web checkout. */
let cachedBuyerEmail = '';

export function saveCheckoutBuyerEmail(raw: string | null | undefined): void {
  const email = normalizeSimplyurBuyerEmail(raw);
  if (email) cachedBuyerEmail = email;
}

export function loadCheckoutBuyerEmail(): string {
  return cachedBuyerEmail;
}
