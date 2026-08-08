/**
 * Rate limits for POST /api/simplyur/auth/mobile-session.
 * REGRESSION-FREEZE[simplyur-mobile-auth-hardening]: mobile-session rate limit SSOT — manifest
 */
export const SIMPLYUR_MOBILE_SESSION_RATE_WINDOW_MS = 60_000
/** Per-IP ceiling for all mobile-session attempts (credentials + OAuth). */
export const SIMPLYUR_MOBILE_SESSION_RATE_MAX_IP = 20
/** Extra per-email ceiling for password login (credential stuffing). */
export const SIMPLYUR_MOBILE_SESSION_RATE_MAX_EMAIL = 10

export function simplyurMobileSessionIpRateKey(ip: string): string {
  const safe = (ip || 'unknown').trim().slice(0, 80) || 'unknown'
  return `simplyur:mobile-session:ip:${safe}`
}

export function simplyurMobileSessionEmailRateKey(email: string): string {
  const safe = email.trim().toLowerCase().slice(0, 254) || 'unknown'
  return `simplyur:mobile-session:email:${safe}`
}
