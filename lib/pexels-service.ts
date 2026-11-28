import { LUXURY_FALLBACK_IMAGE_URL } from '@/lib/image-fallback'
import { withPexelsRealisticQuery } from '@/lib/image-style'
import { pickPexelsCoverIngestUrl } from '@/lib/cover-image-quality'
import { hydrateSharedPexelsStop, sharedPexelsCallGuard, type PexelsCallGuard } from '@/lib/register-photo-stock-rate-guard'

export { pickPexelsCoverIngestUrl } from '@/lib/cover-image-quality'

const PEXELS_SEARCH_URL = 'https://api.pexels.com/v1/search'
/** 같은 검색어 결과 보관 시간 — 같은 키워드를 매시간·매 요청 다시 부르지 않는다 */
export const PEXELS_RESULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000
export const PEXELS_RESULT_CACHE_MAX = 2000

type PexelsSearchParams = { query: string; per_page: number; orientation?: 'landscape' }
export type PexelsSearchResult = { photos: PexelsApiPhoto[]; cached?: boolean } | { error: string }
type PexelsCacheEntry = { at: number; photos: PexelsApiPhoto[] }
const pexelsStore = globalThis as unknown as {
  __btPexelsResultCache?: Map<string, PexelsCacheEntry>
  __btPexelsInflight?: Map<string, Promise<PexelsSearchResult | null>>
}
function pexelsCache(): Map<string, PexelsCacheEntry> {
  return (pexelsStore.__btPexelsResultCache ??= new Map())
}
function pexelsInflight(): Map<string, Promise<PexelsSearchResult | null>> {
  return (pexelsStore.__btPexelsInflight ??= new Map())
}
/** 테스트용: 결과 보관·진행 중 호출 비우기 */
export function resetPexelsSearchCacheForTest(): void {
  pexelsCache().clear()
  pexelsInflight().clear()
}

function headerNumber(res: Response, name: string): number | null {
  const v = res.headers.get(name)
  if (v == null || v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Pexels 검색 단일 관문. 모든 Pexels 검색은 여기를 지난다.
 * REGRESSION-FREEZE[pexels-quota-1128]: 결과 24시간 보관(같은 검색어 재호출 없음)·동시 같은 검색 1번만·
 * 멈춤(403·429·남은 한도 0) 중이면 호출하지 않고 다음 출처로 넘김·실제 호출마다 상태 한 줄 기록(키·본문 없음) — manifest
 * - 키가 없으면 null(빌드·vitest).
 * - spaced: 등록·자동채움 경로는 호출 사이 3.5초(sharedPexelsCallGuard) 를 지킨다.
 */
export async function pexelsSearch(
  params: PexelsSearchParams,
  deps: { spaced?: boolean; guard?: PexelsCallGuard; fetchImpl?: typeof fetch; now?: () => number; apiKey?: string } = {},
): Promise<PexelsSearchResult | null> {
  const key = (deps.apiKey ?? process.env.PEXELS_API_KEY ?? '').trim()
  if (!key) return null
  const query = params.query.trim()
  if (!query) return { photos: [] }
  const perPage = Math.min(Math.max(Math.floor(params.per_page) || 1, 1), 80)
  const orientation = params.orientation ?? 'landscape'
  const now = deps.now ?? (() => Date.now())
  const ck = `${orientation}|${perPage}|${query.toLowerCase()}`
  const cache = pexelsCache()
  const hit = cache.get(ck)
  if (hit && now() - hit.at < PEXELS_RESULT_CACHE_TTL_MS) return { photos: hit.photos, cached: true }
  const inflight = pexelsInflight()
  const pending = inflight.get(ck)
  if (pending) return pending
  const guard = deps.guard ?? sharedPexelsCallGuard()
  const run = (async (): Promise<PexelsSearchResult | null> => {
    // REGRESSION-FREEZE[pexels-stop-persist-1128]: 공용 가드를 쓰는 실제 호출은 저장된 멈춤을 먼저 복원한다(재시작 뒤 첫 호출이 한도 응답을 다시 맞지 않게) — manifest
    if (!deps.guard) await hydrateSharedPexelsStop()
    if (guard.isStopped()) return { error: 'pexels_stopped' }
    if (deps.spaced && !(await guard.acquire())) return { error: 'pexels_stopped' }
    const f = deps.fetchImpl ?? fetch
    let res: Response
    try {
      res = await f(`${PEXELS_SEARCH_URL}?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=${orientation}`, {
        headers: { Authorization: key },
        cache: 'no-store',
      })
    } catch (err) {
      console.log(JSON.stringify({ kind: 'pexels-call', status: null, error: err instanceof Error ? err.name : 'Error' }))
      return { error: 'network' }
    }
    const remaining = headerNumber(res, 'x-ratelimit-remaining')
    const reset = headerNumber(res, 'x-ratelimit-reset')
    guard.onQuotaHeaders(remaining, reset)
    if (!res.ok) guard.onStatus(res.status)
    console.log(
      JSON.stringify({
        kind: 'pexels-call',
        status: res.status,
        remaining,
        stoppedUntil: guard.isStopped() ? new Date(guard.stoppedUntilMs()).toISOString() : null,
      }),
    )
    if (!res.ok) return { error: `HTTP ${res.status}` }
    let body: unknown
    try {
      body = await res.json()
    } catch {
      return { error: 'bad_json' }
    }
    const photos = Array.isArray((body as { photos?: unknown })?.photos) ? ((body as { photos: PexelsApiPhoto[] }).photos) : []
    if (cache.size >= PEXELS_RESULT_CACHE_MAX) {
      const first = cache.keys().next().value
      if (first !== undefined) cache.delete(first)
    }
    cache.set(ck, { at: now(), photos })
    return { photos }
  })()
  inflight.set(ck, run)
  try {
    return await run
  } finally {
    inflight.delete(ck)
  }
}

/** 검색 실패 시 null 대신 럭셔리 파노라마 fallback 반환. 빈 칸/깨진 이미지 금지 */
function withFallback(url: string | null): string {
  return url ?? LUXURY_FALLBACK_IMAGE_URL
}

/** Phase 2: 비창조적 실사 출처 객체. orientation=landscape 적용 */
export type PexelsPhotoObject = {
  url: string
  source: 'Pexels'
  photographer: string
  originalLink: string
  /** Pexels photo id — 중복 제거용 */
  externalId?: string
}

const FALLBACK_OBJECT: PexelsPhotoObject = {
  url: LUXURY_FALLBACK_IMAGE_URL,
  source: 'Pexels',
  photographer: 'Pexels',
  originalLink: 'https://www.pexels.com',
}

/** Pexels가 fallback URL을 반환했는지 (검색 실패). 이 경우 제미나이 fallback 시도 */
export function isPexelsFallbackUrl(url: string): boolean {
  return !url || url === LUXURY_FALLBACK_IMAGE_URL
}

type PexelsApiPhoto = {
  id: number
  width?: number
  height?: number
  src?: { original?: string; large2x?: string; large?: string; medium?: string }
  photographer?: string
  photographer_url?: string
  url?: string
  alt?: string
}

/** 일차 히어로용: 한 쿼리에서 여러 장(메타 포함). 실패 시 빈 배열 */
export type PexelsHeroCandidateMeta = {
  pexelsId: number
  imageUrl: string
  photographer: string
  width: number
  height: number
  originalLink: string
  queryUsed: string
  /** Pexels alt — 동물 거북이 등 오매칭 거절용 */
  altText?: string
  /** Pexels avg_color(#rrggbb) — 흑백 힌트 */
  avgColor?: string | null
}

/** 오류 문구에서 403·429 를 읽는다(키·본문은 남기지 않음) */
export function pexelsErrorStopStatus(err: unknown): 403 | 429 | null {
  const msg = String(err instanceof Error ? err.message : err ?? '')
  if (/\b429\b|too many requests|rate\s*limit/i.test(msg)) return 429
  if (/\b403\b|forbidden/i.test(msg)) return 403
  return null
}

/**
 * 일차 히어로 전용: 검색어는 `buildHeroPexelsQuerySet`에서 이미 장소·도시·국가로 조합함.
 * `travel landscape photorealistic` 접미사는 오히려 무관한 스톡을 끌어와 넣지 않는다.
 */

/**
 * 등록 일정 imageKeyword — Pexels에 실제 사진이 1장 이상 있는지 (fallback URL 금지).
 * REGRESSION-FREEZE[register-pre-photo-pexels-keyword-must-hit]: 0건이면 false — manifest
 */
// REGRESSION-FREEZE[register-pre-photo-pexels-keyword-must-hit]: place-photo samples not mere count — manifest
export async function pexelsKeywordHasPhotos(keyword: string): Promise<boolean> {
  const {
    resolvePexelsImageKeywordForSearch,
    evaluatePexelsKeywordPlacePhotoSamples,
    imageKeywordHasPlaceIdentity,
  } = await import('@/lib/pexels-keyword-place-photo-hit')
  const query = resolvePexelsImageKeywordForSearch(keyword)
  if (!query) return false
  if (!imageKeywordHasPlaceIdentity(query)) return false
  if (!process.env.PEXELS_API_KEY?.trim()) return false
  try {
    const result = await pexelsSearch({ query, per_page: 5, orientation: 'landscape' }, { spaced: true })
    if (!result) return false
    if ('error' in result) {
      // 연타·쿼터·멈춤 — miss로 비우면 정상 장소 키워드가 통째로 증발함
      if (result.error === 'pexels_stopped' || pexelsErrorStopStatus(result.error)) {
        console.warn('[pexelsKeywordHasPhotos] rate-limited — keep keyword', query.slice(0, 80))
        return true
      }
      return false
    }
    if (result.photos.length < 1) {
      return evaluatePexelsKeywordPlacePhotoSamples(query, []).ok
    }
    const samples = result.photos
      .map((p) => {
        const url = pickPexelsCoverIngestUrl(p.src)
        if (!url || isPexelsFallbackUrl(url)) return null
        return { alt: p.alt ?? '', url: p.url ?? url }
      })
      .filter((x): x is { alt: string; url: string } => Boolean(x))
    return evaluatePexelsKeywordPlacePhotoSamples(query, samples).ok
  } catch (err) {
    const msg = String(err ?? '')
    // 연타·쿼터 — miss로 비우면 정상 장소 키워드가 통째로 증발함
    if (/too many requests|429|rate\s*limit/i.test(msg)) {
      console.warn('[pexelsKeywordHasPhotos] rate-limited — keep keyword', query.slice(0, 80))
      return true
    }
    console.error('[pexelsKeywordHasPhotos]', query.slice(0, 80), err)
    return false
  }
}

export async function searchPexelsHeroCandidates(
  keyword: string,
  perPage: number,
  queryUsed: string,
  deps: { guard?: PexelsCallGuard } = {}
): Promise<PexelsHeroCandidateMeta[]> {
  const query = keyword.trim()
  const take = Math.min(Math.max(perPage, 1), 15)
  // 사장님 11/01: Pexels 호출 사이 3.5초 이상, 403·429 면 멈춤(재시도 없음)
  const guard = deps.guard ?? sharedPexelsCallGuard()
  try {
    const result = await pexelsSearch({ query, per_page: take, orientation: 'landscape' }, { spaced: true, guard })
    if (!result) return []
    if ('error' in result) {
      if (result.error === 'pexels_stopped') console.warn('[pexels] hero search skipped (stopped after 403/429/quota 0)')
      const st = pexelsErrorStopStatus(result.error)
      if (st) guard.onStatus(st)
      return []
    }
    if (result.photos.length === 0) return []
    const out: PexelsHeroCandidateMeta[] = []
    for (const p of result.photos) {
      const url = pickPexelsCoverIngestUrl(p.src)
      if (!url || isPexelsFallbackUrl(url)) continue
      out.push({
        pexelsId: p.id,
        imageUrl: url,
        photographer: p.photographer?.trim() || 'Pexels',
        width: typeof p.width === 'number' ? p.width : 0,
        height: typeof p.height === 'number' ? p.height : 0,
        originalLink: p.url?.trim() || 'https://www.pexels.com',
        queryUsed,
        altText: typeof p.alt === 'string' ? p.alt : undefined,
        avgColor: (() => {
          const v = (p as unknown as { avg_color?: unknown }).avg_color
          return typeof v === 'string' ? v : null
        })(),
      })
    }
    return out
  } catch (err) {
    const st = pexelsErrorStopStatus(err)
    if (st) guard.onStatus(st)
    console.error('Pexels hero search error:', err)
    return []
  }
}

function photoToObject(photo: PexelsApiPhoto): PexelsPhotoObject {
  const url = pickPexelsCoverIngestUrl(photo.src) || null
  const pageUrl = photo.url?.trim() || 'https://www.pexels.com'
  return {
    url: withFallback(url),
    source: 'Pexels',
    photographer: photo.photographer?.trim() || 'Pexels',
    originalLink: pageUrl,
    externalId: String(photo.id),
  }
}

/** 검색어로 Pexels 호출 후 출처 포함 객체 반환. landscape + 실사 톤(image-style 공통) 적용. 실패 시 fallback 객체 반환 */
export async function fetchPexelsPhotoObject(keyword: string): Promise<PexelsPhotoObject> {
  const query = withPexelsRealisticQuery(keyword)
  try {
    const result = await pexelsSearch({ query, per_page: 1, orientation: 'landscape' }, { spaced: true })
    if (!result) return FALLBACK_OBJECT
    if ('photos' in result && result.photos.length > 0) {
      return photoToObject(result.photos[0]!)
    }
    return FALLBACK_OBJECT
  } catch (err) {
    console.error('Pexels Search Error:', err)
    return FALLBACK_OBJECT
  }
}

/**
 * 동일 검색어 결과 여러 장 중, isUsed 가 false 인 첫 사진.
 * 일정 슬롯 간·메인과 URL·출처 페이지·Pexels id 중복 완화.
 */
export async function fetchPexelsFirstUnusedPhoto(
  baseKeyword: string,
  isUsed: (p: PexelsPhotoObject) => boolean
): Promise<PexelsPhotoObject> {
  const query = withPexelsRealisticQuery(baseKeyword.trim())
  try {
    const result = await pexelsSearch({ query, per_page: 15, orientation: 'landscape' }, { spaced: true })
    if (!result) return FALLBACK_OBJECT
    if ('photos' in result && result.photos.length > 0) {
      for (const photo of result.photos) {
        const obj = photoToObject(photo)
        if (!isUsed(obj)) return obj
      }
    }
    return FALLBACK_OBJECT
  } catch (err) {
    console.error('Pexels Search Error:', err)
    return FALLBACK_OBJECT
  }
}

export async function fetchPexelsImage(keyword: string): Promise<string> {
  try {
    const response = await pexelsSearch({ query: keyword, per_page: 1, orientation: 'landscape' })
    if (!response) return LUXURY_FALLBACK_IMAGE_URL
    if ('photos' in response && response.photos.length > 0) {
      const photo = response.photos[0]!
      return withFallback(pickPexelsCoverIngestUrl(photo.src) || null)
    }
    return LUXURY_FALLBACK_IMAGE_URL
  } catch (error) {
    console.error('Pexels API Error:', error)
    return LUXURY_FALLBACK_IMAGE_URL
  }
}

/** 가로형(landscape) 고화질 1장. 실패 시 럭셔리 fallback 반환 (null 없음) */
export async function getPexelsImage(keyword: string): Promise<string> {
  try {
    // 공개 화면(갤러리·추천)용 — 같은 검색어는 보관 결과, 멈춤 중이면 바로 기본 사진
    const result = await pexelsSearch({ query: keyword, per_page: 1, orientation: 'landscape' })
    if (!result) return LUXURY_FALLBACK_IMAGE_URL
    if ('photos' in result && result.photos.length > 0) {
      return withFallback(pickPexelsCoverIngestUrl(result.photos[0]!.src) || null)
    }
    return LUXURY_FALLBACK_IMAGE_URL
  } catch (err) {
    console.error('Pexels Search Error:', err)
    return LUXURY_FALLBACK_IMAGE_URL
  }
}
