import { createClient } from 'pexels'
import { LUXURY_FALLBACK_IMAGE_URL } from '@/lib/image-fallback'
import { withPexelsRealisticQuery } from '@/lib/image-style'

const client = createClient(process.env.PEXELS_API_KEY!)

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
  src?: { large2x?: string; large?: string; medium?: string }
  photographer?: string
  url?: string
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
}

/**
 * 일차 히어로 전용: 검색어는 `buildHeroPexelsQuerySet`에서 이미 장소·도시·국가로 조합함.
 * `travel landscape photorealistic` 접미사는 오히려 무관한 스톡을 끌어와 넣지 않는다.
 */
export async function searchPexelsHeroCandidates(
  keyword: string,
  perPage: number,
  queryUsed: string
): Promise<PexelsHeroCandidateMeta[]> {
  const query = keyword.trim()
  const take = Math.min(Math.max(perPage, 1), 15)
  try {
    const result = await client.photos.search({
      query,
      per_page: take,
      orientation: 'landscape',
    })
    if (!('photos' in result) || result.photos.length === 0) return []
    const out: PexelsHeroCandidateMeta[] = []
    for (const photo of result.photos) {
      const p = photo as PexelsApiPhoto
      const url = p.src?.large2x ?? p.src?.large ?? p.src?.medium ?? ''
      if (!url || isPexelsFallbackUrl(url)) continue
      out.push({
        pexelsId: p.id,
        imageUrl: url,
        photographer: p.photographer ?? 'Pexels',
        width: typeof p.width === 'number' ? p.width : 0,
        height: typeof p.height === 'number' ? p.height : 0,
        originalLink: p.url ?? 'https://www.pexels.com',
        queryUsed,
      })
    }
    return out
  } catch (err) {
    console.error('Pexels hero search error:', err)
    return []
  }
}

function photoToObject(photo: PexelsApiPhoto): PexelsPhotoObject {
  const url = photo.src?.large2x ?? photo.src?.large ?? photo.src?.medium ?? null
  return {
    url: withFallback(url),
    source: 'Pexels',
    photographer: photo.photographer ?? 'Pexels',
    originalLink: photo.url ?? 'https://www.pexels.com',
    externalId: String(photo.id),
  }
}

/** 검색어로 Pexels 호출 후 출처 포함 객체 반환. landscape + 실사 톤(image-style 공통) 적용. 실패 시 fallback 객체 반환 */
export async function fetchPexelsPhotoObject(keyword: string): Promise<PexelsPhotoObject> {
  const query = withPexelsRealisticQuery(keyword)
  try {
    const result = await client.photos.search({
      query: query.trim(),
      per_page: 1,
      orientation: 'landscape',
    })
    if ('photos' in result && result.photos.length > 0) {
      return photoToObject(result.photos[0] as PexelsApiPhoto)
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
    const result = await client.photos.search({
      query: query.trim(),
      per_page: 15,
      orientation: 'landscape',
    })
    if ('photos' in result && result.photos.length > 0) {
      for (const photo of result.photos) {
        const obj = photoToObject(photo as PexelsApiPhoto)
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
    const response = await client.photos.search({
      query: keyword,
      per_page: 1,
      orientation: 'landscape',
    })
    if ('photos' in response && response.photos.length > 0) {
      const photo = response.photos[0]
      return withFallback(photo.src.large2x ?? photo.src.large ?? photo.src.medium)
    }
    return LUXURY_FALLBACK_IMAGE_URL
  } catch (error) {
    console.error('Pexels API Error:', error)
    return LUXURY_FALLBACK_IMAGE_URL
  }
}

/** 가로형(landscape), 고화질 large2x 1장. 실패 시 럭셔리 fallback 반환 (null 없음) */
export async function getPexelsImage(keyword: string): Promise<string> {
  try {
    const result = await client.photos.search({
      query: keyword,
      per_page: 1,
      orientation: 'landscape',
    })
    if ('photos' in result && result.photos.length > 0) {
      return withFallback(result.photos[0].src.large2x ?? null)
    }
    return LUXURY_FALLBACK_IMAGE_URL
  } catch (err) {
    console.error('Pexels Search Error:', err)
    return LUXURY_FALLBACK_IMAGE_URL
  }
}
