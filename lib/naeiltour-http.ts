import iconv from 'iconv-lite'

export const NAEILTOUR_BASE = process.env.NAEILTOUR_BASE_URL ?? 'https://www.naeiltour.co.kr'

export async function fetchNaeiltourText(url: string, init?: RequestInit): Promise<string> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'accept-language': 'ko-KR',
      'user-agent': 'Mozilla/5.0 (compatible; BongTour/1.0)',
      ...(init?.headers ?? {}),
    },
  })
  const buf = Buffer.from(await res.arrayBuffer())
  const charset = res.headers.get('content-type')?.match(/charset=([^;\s]+)/i)?.[1]?.toLowerCase()
  if (charset && charset !== 'utf-8' && charset !== 'utf8') {
    try {
      return iconv.decode(buf, charset as 'euc-kr')
    } catch {
      /* fall through */
    }
  }
  const asUtf = buf.toString('utf8')
  if (/[가-힣]/.test(asUtf)) return asUtf
  return iconv.decode(buf, 'euc-kr')
}

export function parseNaeiltourGoodCdFromUrl(originUrl: string | null | undefined): string | null {
  const m = String(originUrl ?? '').match(/[?&]good_cd=([^&#]+)/i)
  return m?.[1]?.trim() || null
}

export function hiddenInputsFromHtml(html: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of html.matchAll(/<input[^>]*type=["']hidden["'][^>]*>/gi)) {
    const tag = m[0]!
    const name = tag.match(/name=["']([^"']+)["']/i)?.[1]
    const value = tag.match(/value=["']([^"']*)["']/i)?.[1] ?? ''
    if (name) out[name] = value
  }
  return out
}

export async function fetchNaeiltourViewTabHtml(
  pageHtml: string,
  tabIndex: number,
  referer: string,
): Promise<string> {
  const h = hiddenInputsFromHtml(pageHtml)
  const data = new URLSearchParams({
    mode: `view_tab_${tabIndex}`,
    number: '1',
    sub_area_cd: h.sub_area_cd ?? '',
    area: h.area ?? '',
    good_cd: h.good_cd ?? '',
    sel_day: h.sel_day ?? '',
    event_ev_ym: h.event_ev_ym ?? h.ev_ym ?? '',
    rep_schd_seq: h.rep_schd_seq ?? '',
    schd_seq: h.schd_seq ?? '',
    event_seq: h.event_seq ?? '',
    chk_no: 'Y',
    sub_cd: h.sub_cd ?? '',
    ev_ym: h.ev_ym ?? '',
  })
  return fetchNaeiltourText(`${NAEILTOUR_BASE}/sub/view_process.asp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=EUC-KR',
      referer,
    },
    body: data.toString(),
    signal: AbortSignal.timeout(30_000),
  })
}
