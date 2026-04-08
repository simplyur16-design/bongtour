import { NextRequest, NextResponse } from 'next/server'
import { createClient } from 'pexels'
import { requireAdmin } from '@/lib/require-admin'

const MAX_PER_PAGE = 12

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
      return NextResponse.json({
        ok: true,
        query: q,
        photos: [],
      } satisfies PexelsSearchResponse)
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
    return NextResponse.json({
      ok: true,
      query: q,
      photos,
    } satisfies PexelsSearchResponse)
  } catch (err) {
    console.error('[api/admin/pexels/search] error', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Pexels 검색에 실패했습니다.' } satisfies PexelsSearchResponse,
      { status: 500 }
    )
  }
}
