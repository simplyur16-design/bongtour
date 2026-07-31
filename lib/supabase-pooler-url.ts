/**
 * Supabase pooler URL helpers.
 *
 * Session mode (`:5432` on `*.pooler.supabase.com`) is capped at pool_size (often 15).
 * Prisma + `pg` sharing that budget is what produced EMAXCONNSESSION and killed
 * simplyur/bongsim reads + `prisma migrate deploy`. Prefer transaction mode (`:6543`).
 */

export function rewriteSupabaseSessionPoolerToTransaction(urlStr: string): string {
  try {
    const u = new URL(urlStr)
    const host = u.hostname.toLowerCase()
    const isPooler = host.includes("pooler.supabase.com") || host.includes("pooler.supabase.co")
    if (isPooler && (u.port === "5432" || u.port === "")) {
      u.port = "6543"
      return u.toString()
    }
    return urlStr
  } catch {
    // Non-standard URLs: only rewrite obvious `:5432` on a pooler host.
    if (/pooler\.supabase\.(com|co)/i.test(urlStr)) {
      return urlStr.replace(/:5432(?=[/?#]|$)/g, ":6543")
    }
    return urlStr
  }
}

export function isTransactionPoolerUrl(urlStr: string): boolean {
  try {
    return new URL(urlStr).port === "6543"
  } catch {
    return /:6543(?=[/?#]|$)/.test(urlStr)
  }
}

/** Prisma needs `pgbouncer=true` on transaction poolers so it does not use prepared statements. */
export function ensurePrismaPgBouncerFlag(urlStr: string): string {
  if (!isTransactionPoolerUrl(urlStr)) return urlStr
  if (/[?&]pgbouncer=/i.test(urlStr)) return urlStr
  const separator = urlStr.includes("?") ? "&" : "?"
  return `${urlStr}${separator}pgbouncer=true`
}
