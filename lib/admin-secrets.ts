/**
 * Admin secret split (Edge/Node — process.env only).
 */

let warnedLegacyDevBypass = false
let warnedLegacyBearer = false

function trimEnv(name: string): string {
  return (process.env[name] ?? "").trim()
}

export function getDevAdminBypassSecret(): string {
  const next = trimEnv("DEV_ADMIN_BYPASS_SECRET")
  if (next) return next
  const legacy = trimEnv("ADMIN_BYPASS_SECRET")
  if (legacy && process.env.NODE_ENV === "development" && !warnedLegacyDevBypass) {
    warnedLegacyDevBypass = true
    console.warn(
      "[admin-secrets] DEV_ADMIN_BYPASS_SECRET missing — using ADMIN_BYPASS_SECRET (deprecated)."
    )
  }
  return legacy
}

export function getAdminServiceBearerSecret(): string {
  const next = trimEnv("ADMIN_SERVICE_BEARER_SECRET")
  if (next) return next
  const legacy = trimEnv("ADMIN_BYPASS_SECRET")
  if (legacy && !warnedLegacyBearer) {
    warnedLegacyBearer = true
    console.warn(
      "[admin-secrets] ADMIN_SERVICE_BEARER_SECRET missing — using ADMIN_BYPASS_SECRET for Bearer (deprecated)."
    )
  }
  return legacy
}
