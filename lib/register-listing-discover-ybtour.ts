/**
 * ybtour 목록 — 등록 상세와 같은 prdt HTML 연결. 전 공급사 공통 딜레이 SSOT 아님.
 * REGRESSION-FREEZE[register-pre-photo-listing-ingest]: ybtour localList — manifest
 */
export const YBTOUR_LISTING_PAUSE_MS_MIN = 1800
export const YBTOUR_LISTING_PAUSE_MS_MAX = 3400

export function parseYbtourDspSidFromUrl(url: string | null | undefined): string | null {
  const m = String(url ?? '').match(/[?&]dspSid=([^&]+)/i)
  const v = m?.[1]?.trim()
  return v || null
}

export function ybtourListingMenuFromUrl(url: string | null | undefined): 'PKG' | 'FIT' {
  const m = String(url ?? '').match(/[?&]menu=([^&]+)/i)
  const v = (m?.[1] ?? '').trim().toUpperCase()
  return v === 'FIT' ? 'FIT' : 'PKG'
}

export function buildYbtourLocalListUrl(dspSid: string, menu: 'PKG' | 'FIT'): string {
  return `https://prdt.ybtour.co.kr/product/localList?menu=${menu}&dspSid=${encodeURIComponent(dspSid)}`
}

export function buildYbtourDetailUrl(evCd: string, dspSid: string, menu: 'PKG' | 'FIT'): string {
  return `https://prdt.ybtour.co.kr/product/detailPackage?menu=${menu}&dspSid=${encodeURIComponent(dspSid)}&evCd=${encodeURIComponent(evCd)}`
}

/** localList HTML·임베드 JSON에서 evCd 수집 */
export function extractYbtourListingEvCds(html: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (raw: string) => {
    const evCd = decodeURIComponent(raw).trim()
    if (!/^[A-Z0-9]+-\d{6}/i.test(evCd)) return
    const key = evCd.toUpperCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(evCd)
  }
  const hrefRe = /[?&]evCd=([A-Za-z0-9-]+)/gi
  let m: RegExpExecArray | null
  while ((m = hrefRe.exec(html))) push(m[1] ?? '')
  const jsonRe = /"evCd"\s*:\s*"([A-Za-z0-9-]+)"/gi
  while ((m = jsonRe.exec(html))) push(m[1] ?? '')
  return out
}

function pauseMs(): number {
  return YBTOUR_LISTING_PAUSE_MS_MIN + Math.floor(Math.random() * (YBTOUR_LISTING_PAUSE_MS_MAX - YBTOUR_LISTING_PAUSE_MS_MIN))
}

export async function waitYbtourListingHumanPause(): Promise<void> {
  await new Promise((r) => setTimeout(r, pauseMs()))
}

export async function fetchYbtourListingDetailUrls(args: {
  seedOriginUrl: string
  /** 레인 강제 — 없으면 시드 URL menu */
  listingMenu?: 'PKG' | 'FIT'
}): Promise<string[]> {
  const dspSid = parseYbtourDspSidFromUrl(args.seedOriginUrl)
  if (!dspSid) return []
  const menu = args.listingMenu ?? ybtourListingMenuFromUrl(args.seedOriginUrl)
  const listUrl = buildYbtourLocalListUrl(dspSid, menu)
  await new Promise((r) => setTimeout(r, pauseMs()))
  try {
    const res = await fetch(listUrl, {
      headers: {
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'accept-language': 'ko-KR',
        referer: args.seedOriginUrl,
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return []
    const html = await res.text()
    return extractYbtourListingEvCds(html).map((evCd) => buildYbtourDetailUrl(evCd, dspSid, menu))
  } catch {
    return []
  }
}
