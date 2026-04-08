const isDev = process.env.NODE_ENV === 'development'

/**
 * parse-and-register 계열 핸들러 구간 측정 — 개발 환경에서만 콘솔 출력.
 */
export function createParseRegisterTiming(logPrefix: string) {
  const t0 = Date.now()
  const prefix = `${logPrefix}[timing]`
  function mark(label: string) {
    if (!isDev) return
    console.log(`${prefix} ${label} +${Date.now() - t0}ms`)
  }
  return { mark, t0 }
}
