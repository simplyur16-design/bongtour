import {
  buildPublicUrlForObjectKey,
  getImageStorageBucket,
  isObjectStorageConfigured,
} from '@/lib/object-storage'
import { PRIVATE_TRIP_HERO_STORAGE_PREFIX } from '@/lib/private-trip-hero-constants'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

const IMAGE_EXT = /\.(jpg|jpeg|png|webp|gif|avif)$/i

/**
 * 우리여행 히어로용 WebP·이미지를 Supabase 버킷 `PRIVATE_TRIP_HERO_STORAGE_PREFIX/` 아래에서 나열한다.
 * (서버 전용 — `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` 필요)
 */
export async function listPrivateTripHeroStoragePublicUrls(): Promise<string[]> {
  if (!isObjectStorageConfigured()) return []

  const bucket = getImageStorageBucket()
  const supabase = getSupabaseAdmin()
  const prefix = PRIVATE_TRIP_HERO_STORAGE_PREFIX

  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 500,
    sortBy: { column: 'name', order: 'asc' },
  })

  if (error) {
    console.error('[private-trip-hero] Supabase Storage list', prefix, error)
    throw new Error(error.message)
  }
  if (!data?.length) return []

  const names = data
    .filter((row) => !row.name.startsWith('.') && IMAGE_EXT.test(row.name))
    .map((row) => row.name)
    .sort((a, b) => a.localeCompare(b, 'ko', { sensitivity: 'base' }))

  return names.map((name) => buildPublicUrlForObjectKey(`${prefix}/${name}`))
}
