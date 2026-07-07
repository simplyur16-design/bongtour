/**
 * Auth.js·OAuth·미들웨어 디버그 SSOT — 운영 기본 무음, AUTH_DEBUG=1 또는 development만 verbose.
 * REGRESSION-FREEZE[auth-debug-ssot]: isAuthDebugEnabled — manifest
 */

export function isAuthDebugEnabled(): boolean {
  if (process.env.AUTH_DEBUG === '1') return true
  return process.env.NODE_ENV === 'development'
}

/** 미들웨어 admin bypass 등 dev-only verbose */
export function isAuthDevVerboseEnabled(): boolean {
  return isAuthDebugEnabled()
}

/** 공급사별 OAUTH_DEBUG env 또는 auth debug */
export function isOAuthProviderTraceEnabled(providerDebugEnv: string | undefined): boolean {
  if (providerDebugEnv === '1') return true
  return isAuthDebugEnabled()
}

export function authDebugLog(scope: string, ...args: unknown[]): void {
  if (!isAuthDevVerboseEnabled()) return
  console.log(`[auth:${scope}]`, ...args)
}

export function authDebugWarn(scope: string, ...args: unknown[]): void {
  if (!isAuthDevVerboseEnabled()) return
  console.warn(`[auth:${scope}]`, ...args)
}

/** state mismatch 등 — 운영에서도 남김 (보안·장애 추적) */
export function authSecurityWarn(scope: string, ...args: unknown[]): void {
  console.warn(`[auth:${scope}]`, ...args)
}
