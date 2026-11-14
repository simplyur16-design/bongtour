/**
 * 표기 의무가 없는 사진만 (Wikimedia Commons 공개 API, 키 없음).
 * 허용: CC0·퍼블릭 도메인. CC BY 등 표기 필요 라이선스는 버린다.
 * 이 모듈의 간격은 호출부(photo-autofill-acquire)가 둔다. 여기 상수는 이 출처만 쓴다.
 */
import type { AutofillCandidate } from '@/lib/photo-autofill-gate'

export const COMMONS_API = 'https://commons.wikimedia.org/w/api.php'
export const COMMONS_USER_AGENT = 'BongTourPhotoAutofill/1.0 (https://bongtour.com)'

const ALLOW_SHORT = /^(cc0\b.*|cc zero\b.*|public domain(?: mark)?|pdm|pd)$/i

/** LicenseShortName 만 본다. 비어 있거나 CC BY 계열이면 탈락. */
export function isNoAttributionCommonsLicense(shortName: string | null | undefined): boolean {
  const s = String(shortName ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!s) return false
  if (/cc\s*-?\s*by|gfdl|all rights reserved/i.test(s)) return false
  return ALLOW_SHORT.test(s)
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#\d+;/g, ' ').replace(/\s+/g, ' ').trim()
}

type Meta = { value?: string }

function metaValue(info: Record<string, unknown>, key: string): string {
  const ext = info.extmetadata
  if (!ext || typeof ext !== 'object') return ''
  const row = (ext as Record<string, Meta>)[key]
  return stripHtml(String(row?.value ?? ''))
}

export function commonsPagesToCandidates(data: unknown): AutofillCandidate[] {
  const pages = (data as { query?: { pages?: Record<string, unknown> } })?.query?.pages
  if (!pages || typeof pages !== 'object') return []
  const out: AutofillCandidate[] = []
  for (const page of Object.values(pages)) {
    if (!page || typeof page !== 'object') continue
    const p = page as { pageid?: number; title?: string; imageinfo?: Array<Record<string, unknown>> }
    const info = p.imageinfo?.[0]
    if (!info) continue
    const mime = String(info.mime ?? '')
    if (mime && !/^image\/(jpeg|png|webp)$/i.test(mime)) continue
    const short = metaValue(info, 'LicenseShortName')
    if (!isNoAttributionCommonsLicense(short)) continue
    const url = String(info.url ?? '').trim()
    const width = Math.floor(Number(info.width) || 0)
    const height = Math.floor(Number(info.height) || 0)
    if (!url || width <= 0) continue
    const title = stripHtml(String(p.title ?? '').replace(/^File:/i, '').replace(/\.[a-z0-9]{2,5}$/i, ' '))
    const desc = metaValue(info, 'ImageDescription') || metaValue(info, 'ObjectName') || title
    const artist = metaValue(info, 'Artist')
    out.push({
      id: String(p.pageid ?? url),
      source: 'CC0',
      url,
      width,
      height,
      photographer: artist || 'Wikimedia Commons',
      originalLink: String(info.descriptionurl ?? url),
      altText: desc,
      title,
      description: short,
    })
  }
  return out
}

export async function searchWikimediaCc0(
  query: string,
  perPage: number,
  fetchImpl: typeof fetch = fetch,
): Promise<AutofillCandidate[]> {
  const q = query.trim()
  if (!q) return []
  const u = new URL(COMMONS_API)
  u.searchParams.set('action', 'query')
  u.searchParams.set('format', 'json')
  u.searchParams.set('generator', 'search')
  u.searchParams.set('gsrsearch', q)
  u.searchParams.set('gsrnamespace', '6')
  u.searchParams.set('gsrlimit', String(Math.max(1, Math.min(15, perPage))))
  u.searchParams.set('prop', 'imageinfo')
  u.searchParams.set('iiprop', 'url|size|mime|extmetadata')
  const res = await fetchImpl(u.toString(), {
    headers: { 'User-Agent': COMMONS_USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`commons_http_${res.status}`)
  return commonsPagesToCandidates(await res.json())
}
