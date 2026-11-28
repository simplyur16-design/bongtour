/**
 * Pixabay 사진 검색 (사장님 11/28 08:08 'pexels 못쓰니 unsplash·pixabay·openverse 등 출처 안넣어도 되는 사진으로 준비해봐라').
 * 공식 문서 https://pixabay.com/api/docs/ (11/28 확인):
 * - 한도: 키당 60초에 100번(X-RateLimit-Limit/Remaining/Reset 헤더). 여유를 두고 60초에 60번까지만 부른다.
 * - 같은 요청은 24시간 보관해야 한다 → 24시간 결과 보관 + 동시 같은 검색 1번.
 * - 영구 핫링크 금지 → 고른 사진은 우리 저장소(사진 풀)에 받아 올려 쓴다(photo-autofill-live-deps commit).
 * - Pixabay Content License: 출처 표기 의무 없음. 사진(photo)만, 일러스트·벡터 제외.
 * 키: 환경변수 PIXABAY_API_KEY. 없으면 네트워크 없이 건너뛰고 'pixabay-call' skipped=no_key 한 줄만(프로세스당 1번) 남긴다.
 * 키·응답 본문은 기록하지 않는다.
 * REGRESSION-FREEZE[free-src-1128]: Pixabay 단일 관문(키 없으면 건너뜀·60초 60번·헤더 0 이면 reset 까지 정지·24시간 보관·저장소 업로드) — manifest
 */
import type { AutofillCandidate } from '@/lib/photo-autofill-gate'
import { sharedPixabayCallGuard, type PixabayCallGuard } from '@/lib/register-photo-stock-rate-guard'

export const PIXABAY_API_KEY_ENV = 'PIXABAY_API_KEY'
export const PIXABAY_API = 'https://pixabay.com/api/'
export const PIXABAY_RESULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_MAX = 2000

export function getPixabayKey(env: Record<string, string | undefined> = process.env): string | null {
  const k = (env[PIXABAY_API_KEY_ENV] ?? '').trim()
  return k ? k : null
}

type PixabayHit = {
  id?: number
  pageURL?: string
  type?: string
  tags?: string
  largeImageURL?: string
  imageWidth?: number
  imageHeight?: number
  user?: string
  user_id?: number
}

type CacheEntry = { at: number; rows: AutofillCandidate[] }
const g = globalThis as unknown as {
  __btPixabayCache?: Map<string, CacheEntry>
  __btPixabayInflight?: Map<string, Promise<AutofillCandidate[]>>
  __btPixabayNoKeyLogged?: boolean
}
function cache(): Map<string, CacheEntry> {
  return (g.__btPixabayCache ??= new Map())
}
function inflight(): Map<string, Promise<AutofillCandidate[]>> {
  return (g.__btPixabayInflight ??= new Map())
}

/** 큰 사진(largeImageURL) 최대 변 1280px */
const PIXABAY_LARGE_MAX = 1280

/** 사진만(일러스트·벡터 제외), 가로, 주소·ID 있는 것만 — 라이선스는 Pixabay Content License(표기 의무 없음) 하나 */
export function pixabayHitsToCandidates(data: unknown): AutofillCandidate[] {
  const hits = (data as { hits?: PixabayHit[] })?.hits
  if (!Array.isArray(hits)) return []
  const out: AutofillCandidate[] = []
  for (const h of hits) {
    if (String(h?.type ?? '').toLowerCase() !== 'photo') continue
    const url = String(h?.largeImageURL ?? '').trim()
    if (!/^https:\/\//i.test(url) || h?.id == null) continue
    const w0 = Math.floor(Number(h.imageWidth) || 0)
    const h0 = Math.floor(Number(h.imageHeight) || 0)
    if (w0 <= 0 || h0 <= 0) continue
    const scale = Math.min(1, PIXABAY_LARGE_MAX / Math.max(w0, h0))
    const width = Math.round(w0 * scale)
    const height = Math.round(h0 * scale)
    const page = String(h.pageURL ?? '').trim()
    const tags = String(h.tags ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20)
    // 사진 페이지 주소 slug(예 /photos/eiffel-tower-paris-1234/)도 설명으로 본다
    let slug = ''
    try {
      slug = decodeURIComponent(new URL(page).pathname.split('/').filter(Boolean).pop() ?? '').replace(/-\d+$/, '').replace(/-/g, ' ')
    } catch {
      slug = ''
    }
    out.push({
      id: `pb-${h.id}`,
      source: 'Pixabay',
      url,
      width,
      height,
      photographer: String(h.user ?? '').trim() || 'Pixabay',
      originalLink: page || `https://pixabay.com/photos/id-${h.id}/`,
      altText: [slug, tags.join(' ')].filter(Boolean).join(' — '),
      title: slug || null,
      description: 'Pixabay Content License',
      tags,
      pageUrl: page || null,
    })
  }
  return out
}

/** Pixabay 검색 — 유일한 호출 지점. 키 없음·멈춤·한도 → [] (다음 출처로). */
export async function searchPixabayCandidates(
  query: string,
  perPage: number,
  deps: { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch; guard?: PixabayCallGuard; now?: () => number } = {},
): Promise<AutofillCandidate[]> {
  const key = getPixabayKey(deps.env ?? process.env)
  if (!key) {
    if (!g.__btPixabayNoKeyLogged) {
      g.__btPixabayNoKeyLogged = true
      console.log(JSON.stringify({ kind: 'pixabay-call', skipped: 'no_key', keyEnv: PIXABAY_API_KEY_ENV }))
    }
    return []
  }
  const q = query.trim().slice(0, 100)
  if (!q) return []
  const take = Math.max(3, Math.min(50, perPage))
  const ck = `${q.toLowerCase()}|${take}`
  const now = deps.now ?? Date.now
  const hit = cache().get(ck)
  if (hit && now() - hit.at < PIXABAY_RESULT_CACHE_TTL_MS) return hit.rows
  const pending = inflight().get(ck)
  if (pending) return pending
  const guard = deps.guard ?? sharedPixabayCallGuard()
  if (!guard.tryAcquire()) return []
  const f = deps.fetchImpl ?? fetch
  const run = (async () => {
    const u = new URL(PIXABAY_API)
    u.searchParams.set('key', key)
    u.searchParams.set('q', q)
    u.searchParams.set('image_type', 'photo')
    u.searchParams.set('orientation', 'horizontal')
    u.searchParams.set('safesearch', 'true')
    u.searchParams.set('min_width', '1200')
    u.searchParams.set('per_page', String(take))
    let status: number | null = null
    try {
      const res = await f(u.toString(), { signal: AbortSignal.timeout(20000) })
      status = res.status
      const remaining = Number(res.headers?.get?.('x-ratelimit-remaining') ?? NaN)
      const resetSec = Number(res.headers?.get?.('x-ratelimit-reset') ?? NaN)
      guard.onQuotaHeaders(Number.isFinite(remaining) ? remaining : null, Number.isFinite(resetSec) ? resetSec : null)
      if (!res.ok) {
        guard.onStatus(res.status)
        console.log(JSON.stringify({ kind: 'pixabay-call', status, remaining: Number.isFinite(remaining) ? remaining : null }))
        return []
      }
      const rows = pixabayHitsToCandidates(await res.json())
      console.log(JSON.stringify({ kind: 'pixabay-call', status, remaining: Number.isFinite(remaining) ? remaining : null, hits: rows.length }))
      if (cache().size >= CACHE_MAX) cache().clear()
      cache().set(ck, { at: now(), rows })
      return rows
    } catch (e) {
      console.log(JSON.stringify({ kind: 'pixabay-call', status, error: e instanceof Error ? e.name : 'Error' }))
      return []
    } finally {
      inflight().delete(ck)
    }
  })()
  inflight().set(ck, run)
  return run
}

export function isPixabayStopped(env: Record<string, string | undefined> = process.env, guard: PixabayCallGuard = sharedPixabayCallGuard()): 'pixabay_no_key' | 'pixabay_limit' | null {
  if (!getPixabayKey(env)) return 'pixabay_no_key'
  if (guard.isStopped() || guard.remaining() <= 0) return 'pixabay_limit'
  return null
}

/** 테스트용 */
export function __resetPixabayCacheForTest(): void {
  cache().clear()
  inflight().clear()
  g.__btPixabayNoKeyLogged = false
}
