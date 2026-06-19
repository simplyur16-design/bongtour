/**
 * 참좋은여행(verygoodtour) 상세 URL 판매종료·404 선검사 — E2E Playwright 전 stale skip.
 *
 * HEAD만 쓰면 live 상품도 302→404 false positive (GET 200인 경우 있음).
 *
 * REGRESSION-FREEZE[verygoodtour-e2e-expired-url-guard]: GET 폴백·MenuCode 정규화 — manifest
 */

const VERYGOOD_FETCH_HEADERS = {
  accept: 'text/html,application/xhtml+xml',
  'accept-language': 'ko-KR,ko;q=0.9',
  referer: 'https://www.verygoodtour.com/',
  'user-agent': 'Mozilla/5.0 (compatible; BongTour/1.0)',
} as const

/** E2E `_normalize_verygood_detail_url` — MenuCode=leaveLayer 제거, ProCode·PriceSeq만 유지 */
export function normalizeVerygoodtourDetailUrlForCollect(detailUrl: string): string {
  const s = detailUrl.trim()
  if (!s.startsWith('http') || !s.toLowerCase().includes('verygoodtour.com')) return s
  try {
    const u = new URL(s)
    const proCode = (u.searchParams.get('ProCode') ?? u.searchParams.get('procode') ?? '').trim()
    if (!proCode) return s
    const priceSeq = (u.searchParams.get('PriceSeq') ?? u.searchParams.get('priceseq') ?? '1').trim() || '1'
    u.search = new URLSearchParams({ ProCode: proCode, PriceSeq: priceSeq }).toString()
    return u.toString()
  } catch {
    return s
  }
}

export function verygoodtourDetailHtmlLooksExpired(html: string): boolean {
  const t = html.slice(0, 8000)
  return (
    /판매가\s*종료|등록되지\s*않은\s*상품|404\.html|ErrorPage/i.test(t) ||
    /history\.back\s*\(\s*\)/i.test(t)
  )
}

async function probeVerygoodDetailWithGet(url: string): Promise<boolean> {
  const res = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: VERYGOOD_FETCH_HEADERS,
    signal: AbortSignal.timeout(25_000),
  })
  if (!res.ok) return true
  const html = await res.text()
  return verygoodtourDetailHtmlLooksExpired(html)
}

export async function isVerygoodtourDetailUrlExpired(detailUrl: string): Promise<boolean> {
  const url = normalizeVerygoodtourDetailUrlForCollect(detailUrl)
  if (!url.startsWith('http')) return true
  try {
    const head = await fetch(url, {
      method: 'HEAD',
      redirect: 'manual',
      headers: { 'User-Agent': VERYGOOD_FETCH_HEADERS['user-agent'] },
      signal: AbortSignal.timeout(20_000),
    })
    if (head.status === 404) return true
    if (head.status >= 301 && head.status <= 308) {
      const loc = (head.headers.get('location') ?? '').toLowerCase()
      if (loc.includes('404.html') || loc.includes('errorpage')) {
        return probeVerygoodDetailWithGet(url)
      }
    }
    if (head.ok) return false
    return probeVerygoodDetailWithGet(url)
  } catch {
    return probeVerygoodDetailWithGet(url).catch(() => false)
  }
}
