/**
 * modetour 목록 — 등록 상세와 같은 www HTML 연결. 전 공급사 공통 딜레이 SSOT 아님.
 * REGRESSION-FREEZE[register-pre-photo-listing-ingest]: modetour search HTML — manifest
 */
export const MODETOUR_LISTING_PAUSE_MS_MIN = 2000
export const MODETOUR_LISTING_PAUSE_MS_MAX = 3600

export function buildModetourDetailUrl(productNo: string): string {
  return `https://www.modetour.com/package/${encodeURIComponent(productNo)}`
}

export function buildModetourSearchUrl(searchWord: string): string {
  return `https://www.modetour.com/search?keyword=${encodeURIComponent(searchWord.trim())}`
}

export function extractModetourListingProductNos(html: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (raw: string) => {
    const productNo = String(raw).trim()
    if (!/^\d{6,12}$/.test(productNo) || productNo === '0') return
    if (seen.has(productNo)) return
    seen.add(productNo)
    out.push(productNo)
  }
  const hrefRe = /\/package\/(\d{6,12})(?:[/?#"'\s]|$)/gi
  let m: RegExpExecArray | null
  while ((m = hrefRe.exec(html))) push(m[1] ?? '')
  const jsonRe = /"(?:productNo|ProductNo)"\s*:\s*"?(\d{6,12})"?/g
  while ((m = jsonRe.exec(html))) push(m[1] ?? '')
  return out
}

function pauseMs(): number {
  return (
    MODETOUR_LISTING_PAUSE_MS_MIN +
    Math.floor(Math.random() * (MODETOUR_LISTING_PAUSE_MS_MAX - MODETOUR_LISTING_PAUSE_MS_MIN))
  )
}

export async function waitModetourListingHumanPause(): Promise<void> {
  await new Promise((r) => setTimeout(r, pauseMs()))
}

export async function fetchModetourListingDetailUrls(args: {
  seedOriginUrl: string
  searchWord: string
}): Promise<string[]> {
  const q = args.searchWord.trim()
  if (!q) return []
  const listUrl = buildModetourSearchUrl(q)
  await new Promise((r) => setTimeout(r, pauseMs()))
  try {
    const res = await fetch(listUrl, {
      headers: {
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'accept-language': 'ko-KR',
        referer: args.seedOriginUrl || 'https://www.modetour.com/',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return []
    const html = await res.text()
    return extractModetourListingProductNos(html).map(buildModetourDetailUrl)
  } catch {
    return []
  }
}
