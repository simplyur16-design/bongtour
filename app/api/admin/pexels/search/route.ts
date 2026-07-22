import { NextRequest, NextResponse } from 'next/server'
import { createClient } from 'pexels'
import { requireAdmin } from '@/lib/require-admin'

const MAX_PER_PAGE = 12
/** REGRESSION-FREEZE[pexels-primary-single-ingest]: short TTL search cache — manifest */
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000
const SEARCH_CACHE_MAX = 80

type CacheEntry = { at: number; body: PexelsSearchResponse }
const searchCache = new Map<string, CacheEntry>()

function getCached(q: string): PexelsSearchResponse | null {
  const hit = searchCache.get(q)
  if (!hit) return null
  if (Date.now() - hit.at > SEARCH_CACHE_TTL_MS) {
    searchCache.delete(q)
    return null
  }
  return hit.body
}

function setCached(q: string, body: PexelsSearchResponse) {
  if (searchCache.size >= SEARCH_CACHE_MAX) {
    const first = searchCache.keys().next().value
    if (first != null) searchCache.delete(first)
  }
  searchCache.set(q, { at: Date.now(), body })
}

export type PexelsSearchPhoto = {
  id: number
  thumbnail: string
  medium: string
  large: string
  photographer: string
  sourceUrl: string
}

export type PexelsSearchResponse =
  | { ok: true; query: string; photos: PexelsSearchPhoto[] }
  | { ok: false; error: string }

/**
 * GET /api/admin/pexels/search?q=...
 * 관리자 전용. Pexels API를 서버에서 호출해 검색 결과를 반환.
 * PEXELS_API_KEY 필요. 빈 결과/에러 시 ok: false 또는 photos: [].
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) {
    console.warn('[api/admin/pexels/search] rejected: not admin')
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' } satisfies PexelsSearchResponse, { status: 401 })
  }
  const apiKey = process.env.PEXELS_API_KEY?.trim()
  const hasApiKey = Boolean(apiKey)
  if (!apiKey) {
    console.warn('[api/admin/pexels/search] missing PEXELS_API_KEY')
    return NextResponse.json(
      { ok: false, error: 'Pexels API 키가 설정되지 않았습니다. (PEXELS_API_KEY)' } satisfies PexelsSearchResponse,
      { status: 503 }
    )
  }
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  if (!q) {
    console.warn('[api/admin/pexels/search] missing query q')
    return NextResponse.json(
      { ok: false, error: '검색어(q)를 입력하세요.' } satisfies PexelsSearchResponse,
      { status: 400 }
    )
  }
  const cached = getCached(q)
  if (cached) {
    console.log('[api/admin/pexels/search] cache-hit', { keywordLen: q.length })
    return NextResponse.json(cached)
  }
  console.log('[api/admin/pexels/search] request', { hasApiKey, keywordLen: q.length })
  try {
    const client = createClient(apiKey)
    const result = await client.photos.search({
      query: q,
      per_page: MAX_PER_PAGE,
      orientation: 'landscape',
    })
    if (!('photos' in result) || !Array.isArray(result.photos)) {
      console.log('[api/admin/pexels/search] unexpected result shape, returning empty photos')
      const empty: PexelsSearchResponse = { ok: true, query: q, photos: [] }
      setCached(q, empty)
      return NextResponse.json(empty)
    }
    const photos: PexelsSearchPhoto[] = result.photos.map((p: { id: number; src?: { small?: string; medium?: string; large?: string }; photographer?: string; url?: string }) => ({
      id: p.id,
      thumbnail: p.src?.small ?? p.src?.medium ?? '',
      medium: p.src?.medium ?? p.src?.large ?? '',
      large: p.src?.large ?? p.src?.medium ?? '',
      photographer: p.photographer ?? 'Pexels',
      sourceUrl: p.url ?? 'https://www.pexels.com',
    }))
    console.log('[api/admin/pexels/search] ok', { count: photos.length, query: q.slice(0, 80) })
    const body: PexelsSearchResponse = { ok: true, query: q, photos }
    setCached(q, body)
    return NextResponse.json(body)
  } catch (err) {
    console.error('[api/admin/pexels/search] error', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Pexels 검색에 실패했습니다.' } satisfies PexelsSearchResponse,
      { status: 500 }
    )
  }
}
