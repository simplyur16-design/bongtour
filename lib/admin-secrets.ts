/**
 * Admin secret split (Edge/Node — process.env only).
 */

let warnedLegacyDevBypass = false
let warnedLegacyBearer = false

/** `1`이면 운영에서도 레거시 시크릿 폴백 안내 로그 출력(기본: 운영에서는 숨김·로그 스팸 방지). */
function logAdminSecretHints(): boolean {
  return process.env.BONGTOUR_LOG_ADMIN_SECRET_HINTS === '1' || process.env.NODE_ENV !== 'production'
}

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
    if (logAdminSecretHints()) {
      console.warn(
        "[admin-secrets] ADMIN_SERVICE_BEARER_SECRET missing — using ADMIN_BYPASS_SECRET for Bearer (deprecated)."
      )
    }
  }
  return legacy
}
