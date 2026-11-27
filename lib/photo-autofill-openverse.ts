/**
 * 표기 의무 없는 사진만 (Openverse 공개 API, 키 없음). 사장님 11/27 21:31 출처 순서: 풀 → Pexels → Openverse/Wikimedia CC0·PD → Unsplash.
 * 허용 라이선스: cc0·pdm(퍼블릭 도메인 마크)만. CC BY 등 표기 필요 라이선스는 요청에서부터 빼고, 응답에서도 다시 거른다.
 * 간격·지터는 호출부(photo-autofill-acquire)가 둔다. 키·응답 본문은 기록하지 않는다.
 * REGRESSION-FREEZE[photo-openverse-cc0-1127]: Openverse 는 cc0·pdm 만 후보 — manifest
 */
import type { AutofillCandidate } from '@/lib/photo-autofill-gate'
import { COMMONS_USER_AGENT, searchWikimediaCc0 } from '@/lib/photo-autofill-cc0'

export const OPENVERSE_API = 'https://api.openverse.org/v1/images/'
const ALLOWED = new Set(['cc0', 'pdm'])

type OvTag = { name?: string }
type OvRow = {
  id?: string
  title?: string | null
  url?: string | null
  creator?: string | null
  license?: string | null
  foreign_landing_url?: string | null
  width?: number | null
  height?: number | null
  tags?: OvTag[] | null
  source?: string | null
}

export function openverseRowsToCandidates(data: unknown): AutofillCandidate[] {
  const rows = (data as { results?: OvRow[] })?.results
  if (!Array.isArray(rows)) return []
  const out: AutofillCandidate[] = []
  for (const r of rows) {
    const license = String(r?.license ?? '').trim().toLowerCase()
    if (!ALLOWED.has(license)) continue
    const url = String(r?.url ?? '').trim()
    if (!/^https:\/\//i.test(url)) continue
    const width = Math.floor(Number(r?.width) || 0)
    const height = Math.floor(Number(r?.height) || 0)
    if (width <= 0) continue
    const tags = (r?.tags ?? []).map((t) => String(t?.name ?? '').trim()).filter(Boolean).slice(0, 20)
    const title = String(r?.title ?? '').trim()
    const id = String(r?.id ?? url)
    out.push({
      id: `ov-${id}`.slice(0, 80),
      source: 'CC0',
      url,
      width,
      height,
      photographer: String(r?.creator ?? '').trim() || 'Openverse',
      originalLink: String(r?.foreign_landing_url ?? '').trim() || `https://openverse.org/image/${id}`,
      altText: title,
      title,
      description: license === 'pdm' ? 'Public Domain Mark' : 'CC0',
      tags,
    })
  }
  return out
}

export async function searchOpenverseCc0(query: string, perPage: number, fetchImpl: typeof fetch = fetch): Promise<AutofillCandidate[]> {
  const q = query.trim()
  if (!q) return []
  const u = new URL(OPENVERSE_API)
  u.searchParams.set('q', q)
  u.searchParams.set('license', 'cc0,pdm')
  u.searchParams.set('page_size', String(Math.max(1, Math.min(20, perPage))))
  u.searchParams.set('mature', 'false')
  const res = await fetchImpl(u.toString(), {
    headers: { 'User-Agent': COMMONS_USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`openverse_http_${res.status}`)
  return openverseRowsToCandidates(await res.json())
}

/** Openverse 먼저, 실패·빈 결과면 Wikimedia Commons. 한쪽 오류는 다른 쪽으로 넘어간다(둘 다 오류면 throw → 호출부 재시도 1회). */
export async function searchNoAttributionCc0(query: string, perPage: number, fetchImpl: typeof fetch = fetch): Promise<AutofillCandidate[]> {
  let ov: AutofillCandidate[] = []
  let ovErr = false
  try {
    ov = await searchOpenverseCc0(query, perPage, fetchImpl)
  } catch {
    ovErr = true
  }
  let wm: AutofillCandidate[] = []
  try {
    wm = await searchWikimediaCc0(query, perPage, fetchImpl)
  } catch (e) {
    if (ovErr) throw e
  }
  return [...ov, ...wm]
}
