import {
  buildPublicUrlForObjectKey,
  getImageStorageBucket,
  isObjectStorageConfigured,
} from '@/lib/object-storage'
import { PRIVATE_TRIP_HERO_STORAGE_PREFIX } from '@/lib/private-trip-hero-constants'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { SupabaseClient } from '@supabase/supabase-js'

const IMAGE_EXT = /\.(jpg|jpeg|png|webp|gif|avif)$/i

function normalizedHeroFolder(): string {
  return PRIVATE_TRIP_HERO_STORAGE_PREFIX.replace(/^\/+|\/+$/g, '')
}

/**
 * List V2: flat `objects` — v1 `list(folder)`가 빈 배열만 주는 Storage 버전에서도 히어로 파일을 잡는다.
 */
async function listHeroObjectKeysViaListV2(supabase: SupabaseClient, bucket: string, folder: string): Promise<string[]> {
  const api = supabase.storage.from(bucket)
  if (typeof api.listV2 !== 'function') return []

  const listPrefix = `${folder}/`
  const keys: string[] = []
  let cursor: string | undefined
  for (let page = 0; page < 25 && keys.length < 600; page++) {
    const { data, error } = await api.listV2({
      prefix: listPrefix,
      limit: 500,
      cursor,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error || !data) break
    for (const obj of data.objects ?? []) {
      const fullKey = (obj.key ?? `${folder}/${obj.name}`).replace(/^\/+/, '')
      if (!fullKey.startsWith(`${folder}/`)) continue
      if (fullKey.includes('/incoming/')) continue
      const rel = fullKey.slice(folder.length + 1)
      if (!rel || rel.includes('/')) continue
      if (!IMAGE_EXT.test(rel)) continue
      keys.push(fullKey)
    }
    if (!data.hasNext || !data.nextCursor) break
    cursor = data.nextCursor
  }
  return [...new Set(keys)]
}

function objectKeysFromV1ListRows(
  folder: string,
  rows: { id: string | null; name: string; metadata?: { mimetype?: string } | null }[],
): string[] {
  const candidates = rows.filter((row) => row.name && !row.name.startsWith('.') && IMAGE_EXT.test(row.name))
  const strict = candidates.filter(
    (row) => row.id != null || (typeof row.metadata?.mimetype === 'string' && row.metadata.mimetype.startsWith('image/')),
  )
  const picked = strict.length > 0 ? strict : candidates
  return picked.map((row) => `${folder}/${row.name}`)
}

/**
 * 우리여행 히어로용 WebP·이미지를 Supabase 버킷 `PRIVATE_TRIP_HERO_STORAGE_PREFIX/` 아래에서 나열한다.
 * (서버 전용 — `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` 필요)
 */
export async function listPrivateTripHeroStoragePublicUrls(): Promise<string[]> {
  if (!isObjectStorageConfigured()) return []

  const bucket = getImageStorageBucket()
  const supabase = getSupabaseAdmin()
  const folder = normalizedHeroFolder()
  const bucketApi = supabase.storage.from(bucket)

  let objectKeys: string[] = await listHeroObjectKeysViaListV2(supabase, bucket, folder)

  if (objectKeys.length === 0) {
    for (const path of [folder, `${folder}/`]) {
      const { data, error } = await bucketApi.list(path === '' ? undefined : path, {
        limit: 500,
        sortBy: { column: 'name', order: 'asc' },
      })
      if (error) {
        console.error('[private-trip-hero] Supabase Storage list (v1)', path, error)
        throw new Error(error.message)
      }
      if (data?.length) {
        objectKeys = objectKeysFromV1ListRows(folder, data)
        if (objectKeys.length > 0) break
      }
    }
  }

  if (objectKeys.length === 0) return []

  objectKeys.sort((a, b) => a.localeCompare(b, 'ko', { sensitivity: 'base' }))
  return objectKeys.map((key) => buildPublicUrlForObjectKey(key))
}
