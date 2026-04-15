/**
 * 대표 이미지 스토리지 파일명·DB `bgImageSourceType`과 동일한 출처 세그먼트(SSOT).
 * 파일명: `{geo-slug}-{sourceType}-{sourceId}.{ext}`
 */

import { toAssetSlug } from '@/lib/image-asset-slug'

/** 스토리지/DB에 쓰는 canonical 출처 키(소문자·하이픈·확장 가능) */
export const HERO_STORAGE_SOURCE_ALIASES: Record<string, string> = {
  pexels: 'pexels',
  gemini: 'gemini',
  gemini_auto: 'gemini',
  gemini_manual: 'gemini',
  manual: 'manual',
  istock: 'istock',
  userphoto: 'userphoto',
  photo_owned: 'userphoto',
  photopool: 'photopool',
  'destination-set': 'destination-set',
  'city-asset': 'city-asset',
  'attraction-asset': 'attraction-asset',
  other: 'other',
}

/** 파일명 `{geo}-{source}-{id}` 에서 `source` 자리에 올 수 있는 canonical 값(SSOT). GC·검증에서 사용. */
export const HERO_FILENAME_SOURCE_SEGMENTS: ReadonlySet<string> = new Set([
  ...new Set(Object.values(HERO_STORAGE_SOURCE_ALIASES)),
  'unknown',
])

/**
 * `bgImageSource`(또는 요청 출처) → 파일명·`bgImageSourceType`에 쓸 세그먼트.
 * 매핑 없으면 보수적으로 slug(영숫자·하이픈)로 정규화.
 */
export function toHeroStorageSourceTypeSegment(raw: string | null | undefined): string {
  const k = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (!k) return 'unknown'
  if (HERO_STORAGE_SOURCE_ALIASES[k]) return HERO_STORAGE_SOURCE_ALIASES[k]
  const slug = toAssetSlug(k).replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '')
  const trimmed = slug.slice(0, 48)
  return trimmed || 'unknown'
}

/** 파일명 중 `{sourceId}` 구간: 영숫자·하이픈만, 길이 제한 */
export function sanitizeHeroStorageSourceIdSegment(id: string): string {
  const s = String(id ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return (s || 'x').slice(0, 96)
}
