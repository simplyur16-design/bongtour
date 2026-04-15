/** 모바일 홈·헤더·시즌 캐러셀 등 — 개발 환경에서만 클라이언트 진단 로그 */
export function devWarnMobileHome(scope: string, ...rest: unknown[]): void {
  if (process.env.NODE_ENV !== 'development') return
  try {
    // eslint-disable-next-line no-console
    console.warn(`[mobile-home:${scope}]`, ...rest)
  } catch {
    /* console unavailable */
  }
}
