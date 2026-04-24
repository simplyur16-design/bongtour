import {
  buildPublicUrlForObjectKey,
  isObjectStorageConfigured,
  listStorageObjectKeysRecursive,
} from '@/lib/object-storage'
import { PRIVATE_TRIP_HERO_STORAGE_PREFIX } from '@/lib/private-trip-hero-constants'

const IMAGE_EXT = /\.(jpg|jpeg|png|webp|gif|avif)$/i

function normalizedHeroFolder(): string {
  return PRIVATE_TRIP_HERO_STORAGE_PREFIX.replace(/^\/+|\/+$/g, '')
}

/**
 * 우리여행 히어로용 WebP·이미지를 Object Storage `PRIVATE_TRIP_HERO_STORAGE_PREFIX/` 아래에서 나열한다.
 */
export async function listPrivateTripHeroStoragePublicUrls(): Promise<string[]> {
  if (!isObjectStorageConfigured()) return []

  const folder = normalizedHeroFolder()
  const prefix = `${folder}/`
  const { objects } = await listStorageObjectKeysRecursive({ prefix, maxKeys: 600 })

  const keys = objects
    .map((o) => o.objectKey)
    .filter((k) => Boolean(k) && !k.includes('/incoming/'))
    .filter((k) => {
      const rel = k.startsWith(prefix) ? k.slice(prefix.length) : k.slice(folder.length + 1)
      return Boolean(rel) && !rel.includes('/') && IMAGE_EXT.test(rel)
    })

  if (keys.length === 0) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[private-trip-hero] Storage list returned 0 image keys', {
        prefix,
      })
    }
    return []
  }

  keys.sort((a, b) => a.localeCompare(b, 'ko', { sensitivity: 'base' }))
  return keys.map((key) => buildPublicUrlForObjectKey(key))
}
