import { PRIVATE_TRIP_HERO_STORAGE_PREFIX } from '@/lib/private-trip-hero-constants'
import {
  isObjectStorageConfigured,
  removeStorageObject,
  tryParseObjectKeyFromPublicUrl,
} from '@/lib/object-storage'

const IMAGE_EXT = /\.(jpg|jpeg|png|webp|gif|avif)$/i

function normalizedHeroFolder(): string {
  return PRIVATE_TRIP_HERO_STORAGE_PREFIX.replace(/^\/+|\/+$/g, '')
}

/**
 * 공개 URL(목록 API가 준 것) → `private-trip-hero/` 단일 파일만 Storage에서 삭제.
 */
export async function deletePrivateTripHeroImageByPublicUrl(publicUrl: string): Promise<void> {
  if (!isObjectStorageConfigured()) {
    throw new Error('Supabase Storage가 설정되지 않았습니다.')
  }
  const trimmed = publicUrl.trim()
  if (!trimmed) throw new Error('삭제할 대상이 비어 있습니다.')

  const key = tryParseObjectKeyFromPublicUrl(trimmed)
  if (!key) {
    throw new Error('이 서비스의 Storage 공개 URL만 삭제할 수 있습니다.')
  }

  const folder = normalizedHeroFolder()
  if (!key.startsWith(`${folder}/`)) {
    throw new Error('우리여행 히어로 접두사 밖 경로는 삭제할 수 없습니다.')
  }
  if (key.includes('..')) {
    throw new Error('잘못된 객체 경로입니다.')
  }
  if (key.includes('/incoming/')) {
    throw new Error('임시 업로드 경로는 삭제할 수 없습니다.')
  }

  const rel = key.slice(folder.length + 1)
  if (!rel || rel.includes('/')) {
    throw new Error('하위 폴더 객체는 삭제할 수 없습니다.')
  }
  if (!IMAGE_EXT.test(rel)) {
    throw new Error('이미지 파일만 삭제할 수 있습니다.')
  }

  await removeStorageObject(key)
}
