/**
 * 여행상품에 저장되는 이미지 URL을 Supabase Storage 기준으로 통일한다.
 * 검색/미리보기 단계의 외부 URL은 여기 들어오기 전 단계에서만 사용한다.
 */

import type { PrismaClient } from '@prisma/client'
import { tryParseObjectKeyFromPublicUrl, isObjectStorageConfigured } from '@/lib/object-storage'
import { savePhotoFromUrlWithRetry } from '@/lib/photo-pool'

/** 최종 상품/일정/히어로에 남기면 안 되는 `http(s)` 외부 URL (우리 Storage 공개 URL 제외) */
export function isExternalHttpProductImageUrl(url: string): boolean {
  const t = (url ?? '').trim()
  if (!t || !/^https?:\/\//i.test(t)) return false
  return tryParseObjectKeyFromPublicUrl(t) == null
}

/**
 * 대표(bg)·캐시 메인 등 **커버** 용도: 외부 URL은 **PhotoPool(WebP)로만** 내부화한다.
 * (Pexels든 그 외든) Pool 실패 시 예외 — 다른 Storage 경로로 우회 저장하지 않는다.
 */
export async function internalizeProductCoverImageUrl(
  prisma: PrismaClient,
  input: {
    remoteUrl: string
    destination: string
    poolAttractionLabel: string
    poolSource?: string
    pexelsPhotoId: number | null
    photographer: string | null
    pexelsPageUrl: string | null
    searchKeyword: string | null
    placeName: string | null
    cityName: string | null
  }
): Promise<string> {
  const u = String(input.remoteUrl ?? '').trim()
  if (!u) throw new Error('internalizeProductCoverImageUrl: 빈 URL')
  if (!isObjectStorageConfigured()) {
    throw new Error('Supabase Storage가 설정되지 않아 이미지를 내부 저장할 수 없습니다.')
  }
  if (!isExternalHttpProductImageUrl(u)) return u

  const city = (input.destination ?? '').trim() || 'unknown'
  const attraction = (input.poolAttractionLabel ?? '').trim().slice(0, 80) || 'Landmark'
  const poolSrc = (input.poolSource ?? 'Pexels').trim() || 'Pexels'

  const pooled = await savePhotoFromUrlWithRetry(prisma, u, city, attraction, poolSrc)
  if (pooled) return pooled.filePath

  throw new Error(
    '외부 이미지를 PhotoPool에 저장하지 못했습니다. 네트워크·원본 차단·용량을 확인한 뒤 다시 시도하세요.'
  )
}

/**
 * 일차 히어로 번들용: 외부 URL은 **PhotoPool로만** 내부화한다.
 */
export async function internalizeHeroDisplayUrl(
  prisma: PrismaClient,
  input: {
    remoteUrl: string
    destination: string
    attractionStem: string
    pexelsPhotoId: number | null
    photographer: string | null
    pexelsPageUrl: string | null
    searchKeyword: string | null
    placeName: string | null
    cityName: string | null
  }
): Promise<string> {
  const u = String(input.remoteUrl ?? '').trim()
  if (!u) throw new Error('internalizeHeroDisplayUrl: 빈 URL')
  if (!isObjectStorageConfigured()) {
    throw new Error('Supabase Storage가 설정되지 않아 히어로 이미지를 내부 저장할 수 없습니다.')
  }
  if (!isExternalHttpProductImageUrl(u)) return u

  const city = (input.destination ?? '').trim() || 'unknown'
  const stem = (input.attractionStem ?? '').trim().slice(0, 80) || 'hero'

  const pooled = await savePhotoFromUrlWithRetry(prisma, u, city, stem, 'Pexels')
  if (pooled) return pooled.filePath

  throw new Error(
    '히어로 외부 이미지를 PhotoPool에 저장하지 못했습니다. 네트워크·원본 차단을 확인한 뒤 다시 시도하세요.'
  )
}
