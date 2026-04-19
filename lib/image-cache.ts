/**
 * Phase 2: 이미지 중복 수확 방지 및 기존 자산 재사용(Caching).
 * destination + imageKeyword 조합 일치 검색, URL 유효성 검사, Deep Copy로 출처 유지.
 */

import type { PexelsPhotoObject } from '@/lib/pexels-service'
import { tryParseObjectKeyFromPublicUrl } from '@/lib/object-storage'

export type CachedPhotoObject = PexelsPhotoObject

/** 최종 상품과 동일하게: 외부 CDN URL은 캐시 히트로 재사용하지 않는다(내부 Storage 공개 URL·상대 경로만). */
function isCacheableInternalImageUrl(url: string): boolean {
  const t = (url ?? '').trim()
  if (!t) return false
  if (t.startsWith('/')) return true
  if (!/^https?:\/\//i.test(t)) return false
  return tryParseObjectKeyFromPublicUrl(t) != null
}

/** 캐시 키: destination|imageKeyword (정규화) */
function cacheKey(destination: string, imageKeyword: string): string {
  const d = (destination ?? '').trim().toLowerCase()
  const k = (imageKeyword ?? '').trim().toLowerCase()
  return `${d}|${k}`
}

/** schedule JSON 한 항목 타입 (imageUrl 또는 imageSource 보유 가능) */
type ScheduleEntry = {
  day?: number
  title?: string
  description?: string
  imageKeyword?: string
  imageUrl?: string | null
  imageSource?: { source?: string; photographer?: string; originalLink?: string }
}

/** DB에서 동일 destination + imageKeyword 조합 검색 후 캐시 맵 구성 */
export async function buildImageCacheFromDb(
  prisma: {
    product: {
      findMany: (args: { select: { schedule: boolean; destination?: boolean } }) => Promise<
        { schedule: string | null; destination?: string | null }[]
      >
    }
  },
  currentDestination: string
): Promise<Map<string, CachedPhotoObject>> {
  const map = new Map<string, CachedPhotoObject>()
  const dest = (currentDestination ?? '').trim()
  type Row = { schedule: string | null; destination?: string | null; bgImageUrl?: string | null }
  const products: Row[] = await (prisma.product as { findMany: (a: { select: Record<string, boolean> }) => Promise<Row[]> }).findMany({
    select: { schedule: true, destination: true, bgImageUrl: true },
  })
  for (const p of products) {
    const productDest = (p.destination ?? dest ?? '').trim()
    if (p.bgImageUrl && typeof p.bgImageUrl === 'string' && isCacheableInternalImageUrl(p.bgImageUrl)) {
      const key = cacheKey(productDest, 'Landmark')
      if (!map.has(key)) {
        map.set(key, {
          url: p.bgImageUrl,
          source: 'Pexels',
          photographer: 'Pexels',
          originalLink: 'https://www.pexels.com',
        })
      }
    }
    const scheduleRaw = p.schedule
    if (!scheduleRaw || typeof scheduleRaw !== 'string') continue
    let arr: ScheduleEntry[]
    try {
      arr = JSON.parse(scheduleRaw) as ScheduleEntry[]
    } catch {
      continue
    }
    if (!Array.isArray(arr)) continue
    for (const item of arr) {
      const keyword = (item.imageKeyword ?? item.title ?? '').trim()
      if (!keyword) continue
      const url = item.imageUrl
      if (!url || typeof url !== 'string' || !isCacheableInternalImageUrl(url)) continue
      const src = item.imageSource
      const photo: CachedPhotoObject = {
        url,
        source: (src?.source as 'Pexels') ?? 'Pexels',
        photographer: src?.photographer ?? 'Pexels',
        originalLink: src?.originalLink ?? 'https://www.pexels.com',
      }
      const key = cacheKey(productDest, keyword)
      if (!map.has(key)) map.set(key, photo)
    }
  }
  return map
}

/** 재사용 시 URL 유효성 검사. 실패 시 false (새로 수확 필요) */
export async function validateImageUrl(url: string): Promise<boolean> {
  if (!url || !url.startsWith('http')) return false
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
    return res.ok
  } catch {
    try {
      const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5000) })
      return res.ok
    } catch {
      return false
    }
  }
}

/** 캐시에서 조회. 있으면 Deep Copy 반환, 없으면 null. 유효성 실패 시 null */
export async function getCachedPhoto(
  cache: Map<string, CachedPhotoObject>,
  destination: string,
  imageKeyword: string,
  validate: boolean = true
): Promise<CachedPhotoObject | null> {
  const key = cacheKey(destination, imageKeyword)
  const found = cache.get(key)
  if (!found) return null
  const deepCopy: CachedPhotoObject = {
    url: found.url,
    source: found.source,
    photographer: found.photographer,
    originalLink: found.originalLink,
  }
  if (validate && !(await validateImageUrl(deepCopy.url))) return null
  return deepCopy
}
