/**
 * 참좋은여행(verygoodtour) 상세 URL 판매종료·404 선검사 — E2E Playwright 전 stale skip.
 *
 * REGRESSION-FREEZE[verygoodtour-e2e-expired-url-guard]: 404 redirect 감지 — manifest
 */
export async function isVerygoodtourDetailUrlExpired(detailUrl: string): Promise<boolean> {
  const url = detailUrl.trim()
  if (!url.startsWith('http')) return true
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BongTour/1.0)' },
      signal: AbortSignal.timeout(20_000),
    })
    if (res.status === 404) return true
    if (res.status === 301 || res.status === 302 || res.status === 303 || res.status === 307 || res.status === 308) {
      const loc = (res.headers.get('location') ?? '').toLowerCase()
      if (loc.includes('404.html') || loc.includes('errorpage')) return true
    }
    return false
  } catch {
    // 네트워크·타임아웃 — E2E가 최종 판단
    return false
  }
}
