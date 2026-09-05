/**
 * Pure Google OAuth helpers — no native module import (vitest-safe).
 * REGRESSION-FREEZE[simplyur-google-signin-scopes]: openid scopes + extra fallback — manifest
 */
export const GOOGLE_SIGNIN_SCOPES = ['openid', 'profile', 'email'] as const;

export function pickGoogleOAuthClientId(...candidates: Array<string | undefined>): string {
  for (const c of candidates) {
    const id = (c ?? '').trim();
    if (id) return id;
  }
  return '';
}
