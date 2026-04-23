import { timingSafeEqual } from "node:crypto";

export type ResolvedInternalSecret =
  | { ok: true; secret: string }
  | { ok: false; reason: "unconfigured" };

/** Fail closed: empty/whitespace env does not authorize internal routes. */
export function resolveInternalRouteSecret(envValue: string | undefined): ResolvedInternalSecret {
  const secret = envValue?.trim();
  if (!secret) return { ok: false, reason: "unconfigured" };
  return { ok: true, secret };
}

/**
 * Constant-time comparison of the incoming header against the configured secret.
 * A length mismatch short-circuits to `false` (length leak is acceptable here);
 * when lengths match, `timingSafeEqual` prevents byte-by-byte timing leaks.
 */
export function isInternalRequestAuthorized(headerValue: string | null, expectedSecret: string): boolean {
  const h = headerValue?.trim();
  if (!h) return false;
  const a = Buffer.from(h, "utf8");
  const b = Buffer.from(expectedSecret, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
