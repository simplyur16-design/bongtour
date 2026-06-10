/** www·apex 혼용 시 OAuth state·세션 쿠키를 공유할 registrable domain (예: `.bongtour.com`). */
export function resolveOAuthStateCookieDomain(hostname: string): string | undefined {
  const fromEnv =
    process.env.KAKAO_OAUTH_COOKIE_DOMAIN?.trim() ??
    process.env.NAVER_OAUTH_COOKIE_DOMAIN?.trim() ??
    process.env.OAUTH_COOKIE_DOMAIN?.trim()
  if (fromEnv) {
    const h = fromEnv.replace(/^\./, '')
    return h ? `.${h}` : undefined
  }

  const host = hostname.trim()
  if (!host || host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
    return undefined
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return undefined

  const apex = host.startsWith('www.') ? host.slice(4) : host
  if (!apex || !apex.includes('.')) return undefined
  return `.${apex}`
}
