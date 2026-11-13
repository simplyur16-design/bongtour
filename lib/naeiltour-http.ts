import iconv from 'iconv-lite'
import {
  supplierFetch,
  SupplierFetchError,
  type SupplierFetchFailure,
  type SupplierFetchRetryPolicy,
  type SupplierFetchSuccess,
} from '@/lib/supplier-http/supplier-fetch'

export const NAEILTOUR_BASE = process.env.NAEILTOUR_BASE_URL ?? 'https://www.naeiltour.co.kr'

/** 내일투어 전용 — 기본 요청 타임아웃 (공용 스크래퍼 SSOT 아님). */
export const NAEILTOUR_FETCH_TIMEOUT_MS = 30_000
export const NAEILTOUR_VIEW_PAGE_TIMEOUT_MS = 45_000

/**
 * 내일투어 전용 재시도 — 조회성 요청만 1회, 5~8초 대기 + 지터. 429는 Retry-After(최대 30초) 존중.
 * REGRESSION-FREEZE[naeiltour-fetch-resilience]: 재시도 1회·5초 이상 대기 — manifest
 */
export const NAEILTOUR_FETCH_RETRY: SupplierFetchRetryPolicy = {
  maxRetries: 1,
  baseDelayMs: 5_000,
  jitterMs: 3_000,
  maxRetryAfterMs: 30_000,
}

export type NaeiltourTextFetchResult =
  | { ok: true; text: string; fetch: SupplierFetchSuccess }
  | SupplierFetchFailure

export function decodeNaeiltourBody(buf: Buffer, contentType: string | null): string {
  const charset = contentType?.match(/charset=([^;\s]+)/i)?.[1]?.toLowerCase()
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

export async function fetchNaeiltourTextResult(
  url: string,
  init?: Omit<RequestInit, 'signal'>,
  opts?: { part?: string; timeoutMs?: number },
): Promise<NaeiltourTextFetchResult> {
  const r = await supplierFetch({
    supplier: 'naeiltour',
    part: opts?.part ?? 'page',
    url,
    init: {
      ...init,
      headers: {
        'accept-language': 'ko-KR',
        'user-agent': 'Mozilla/5.0 (compatible; BongTour/1.0)',
        ...(init?.headers ?? {}),
      },
    },
    timeoutMs: opts?.timeoutMs ?? NAEILTOUR_FETCH_TIMEOUT_MS,
    // 내일투어 상세·탭·월별 목록은 모두 조회성 요청 (view_process.asp POST 포함).
    idempotent: true,
    retry: NAEILTOUR_FETCH_RETRY,
  })
  if (!r.ok) return r
  return { ok: true, text: decodeNaeiltourBody(r.body, r.headers.get('content-type')), fetch: r }
}

/** 실패 시 SupplierFetchError (timeout·연결·HTTP 상태 포함)를 던진다. */
export async function fetchNaeiltourText(
  url: string,
  init?: Omit<RequestInit, 'signal'>,
  opts?: { part?: string; timeoutMs?: number },
): Promise<string> {
  const r = await fetchNaeiltourTextResult(url, init, opts)
  if (!r.ok) throw new SupplierFetchError(r)
  return r.text
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

export async function fetchNaeiltourViewTabHtmlResult(
  pageHtml: string,
  tabIndex: number,
  referer: string,
): Promise<NaeiltourTextFetchResult> {
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
  return fetchNaeiltourTextResult(
    `${NAEILTOUR_BASE}/sub/view_process.asp`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded; charset=EUC-KR',
        referer,
      },
      body: data.toString(),
    },
    { part: `tab${tabIndex}`, timeoutMs: NAEILTOUR_FETCH_TIMEOUT_MS },
  )
}

export async function fetchNaeiltourViewTabHtml(
  pageHtml: string,
  tabIndex: number,
  referer: string,
): Promise<string> {
  const r = await fetchNaeiltourViewTabHtmlResult(pageHtml, tabIndex, referer)
  if (!r.ok) throw new SupplierFetchError(r)
  return r.text
}
