import { randomInt } from "node:crypto";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PRESS_OTP_TTL_MS = 10 * 60 * 1000;
export const PRESS_OTP_MAX_ATTEMPTS = 5;

export function normalizeWorkEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return null;
  return email;
}

export function generatePressOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function isPressOtpAttemptLocked(attemptCount: number): boolean {
  return attemptCount >= PRESS_OTP_MAX_ATTEMPTS;
}

export function pressOtpAttemptsRemaining(attemptCount: number): number {
  return Math.max(0, PRESS_OTP_MAX_ATTEMPTS - attemptCount);
}
