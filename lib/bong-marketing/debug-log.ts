export function isBongMarketingDebugEnabled(): boolean {
  return process.env.DEBUG_BONG_MARKETING === '1'
}

export function debugLog(scope: string, ...args: unknown[]): void {
  if (!isBongMarketingDebugEnabled()) return
  console.log(`[bong-marketing:${scope}]`, ...args)
}

export function debugError(scope: string, ...args: unknown[]): void {
  if (!isBongMarketingDebugEnabled()) return
  console.error(`[bong-marketing:${scope}]`, ...args)
}

export function debugWarn(scope: string, ...args: unknown[]): void {
  if (!isBongMarketingDebugEnabled()) return
  console.warn(`[bong-marketing:${scope}]`, ...args)
}
