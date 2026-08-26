/**
 * verygoodtour 목록 — 등록 상세와 같은 www HTML 연결. 전 공급사 공통 딜레이 SSOT 아님.
 * REGRESSION-FREEZE[register-pre-photo-listing-ingest]: verygoodtour ProductList — manifest
 */
export const VERYGOODTOUR_LISTING_PAUSE_MS_MIN = 2500
export const VERYGOODTOUR_LISTING_PAUSE_MS_MAX = 4300

export function buildVerygoodtourDetailUrl(proCode: string): string {
  return `https://www.verygoodtour.com/Product/PackageDetail?ProCode=${encodeURIComponent(proCode)}`
}

export function buildVerygoodtourListUrl(searchWord: string): string {
  return `https://www.verygoodtour.com/Product/ProductList?SearchWord=${encodeURIComponent(searchWord.trim())}`
}

export function extractVerygoodtourListingProCodes(html: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (raw: string) => {
    const proCode = decodeURIComponent(raw).trim()
    if (!/^[A-Z]{2,4}\d{3,5}-[A-Z0-9]+$/i.test(proCode) && !/^[A-Z]{2,4}\d{4,}/i.test(proCode)) return
    const key = proCode.toUpperCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(proCode)
  }
  const hrefRe = /[?&]ProCode=([A-Za-z0-9-]+)/gi
  let m: RegExpExecArray | null
  while ((m = hrefRe.exec(html))) push(m[1] ?? '')
  const jsonRe = /"(?:ProCode|proCode)"\s*:\s*"([A-Za-z0-9-]+)"/gi
  while ((m = jsonRe.exec(html))) push(m[1] ?? '')
  return out
}

function pauseMs(): number {
  return (
    VERYGOODTOUR_LISTING_PAUSE_MS_MIN +
    Math.floor(Math.random() * (VERYGOODTOUR_LISTING_PAUSE_MS_MAX - VERYGOODTOUR_LISTING_PAUSE_MS_MIN))
  )
}

export async function waitVerygoodtourListingHumanPause(): Promise<void> {
  await new Promise((r) => setTimeout(r, pauseMs()))
}

export async function fetchVerygoodtourListingDetailUrls(args: {
  seedOriginUrl: string
  searchWord: string
}): Promise<string[]> {
  const q = args.searchWord.trim()
  if (!q) return []
  const listUrl = buildVerygoodtourListUrl(q)
  await new Promise((r) => setTimeout(r, pauseMs()))
  try {
    const res = await fetch(listUrl, {
      headers: {
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'accept-language': 'ko-KR',
        referer: args.seedOriginUrl || 'https://www.verygoodtour.com/',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return []
    const html = await res.text()
    return extractVerygoodtourListingProCodes(html).map(buildVerygoodtourDetailUrl)
  } catch {
    return []
  }
}
