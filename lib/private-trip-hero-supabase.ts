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

function basenameForImageTest(name: string): string {
  const n = name.replace(/^\/+/, '')
  const i = n.lastIndexOf('/')
  return i >= 0 ? n.slice(i + 1) : n
}

function rowNameToObjectKey(folder: string, name: string): string {
  const n = name.replace(/^\/+/, '')
  if (n.startsWith(`${folder}/`)) return n
  return `${folder}/${n}`
}

function isHeroImageRowName(name: string): boolean {
  const base = basenameForImageTest(name)
  return Boolean(base && !base.startsWith('.') && IMAGE_EXT.test(base))
}

/**
 * List V2: flat `objects` — v1 `list(folder)`가 빈 배열만 주는 Storage 버전에서도 히어로 파일을 잡는다.
 */
type ListV2Page = {
  objects?: { key?: string; name?: string }[]
  hasNext?: boolean
  nextCursor?: string
}

type ListV2Result = {
  data: ListV2Page | null
  error: { message?: string } | null
}

async function listHeroObjectKeysViaListV2(supabase: SupabaseClient, bucket: string, folder: string): Promise<string[]> {
  const api = supabase.storage.from(bucket) as unknown as {
    listV2?: (opts: Record<string, unknown>) => Promise<ListV2Result>
  }
  if (typeof api.listV2 !== 'function') return []

  const listPrefix = `${folder}/`
  const keys: string[] = []
  let cursor: string | undefined
  for (let pageIdx = 0; pageIdx < 25 && keys.length < 600; pageIdx++) {
    const fetchPage = async (withSort: boolean): Promise<ListV2Result> =>
      (await api.listV2!({
        prefix: listPrefix,
        limit: 500,
        cursor,
        ...(withSort ? { sortBy: { column: 'name', order: 'asc' as const } } : {}),
      })) as ListV2Result

    let res = await fetchPage(true)
    if (res.error) res = await fetchPage(false)
    if (res.error || res.data == null) break

    const batch = res.data

    for (const obj of batch.objects ?? []) {
      const raw = (obj.key ?? obj.name ?? '').replace(/^\/+/, '')
      if (!raw) continue
      const fullKey = raw.startsWith(`${folder}/`) ? raw : `${folder}/${raw}`
      if (!fullKey.startsWith(`${folder}/`)) continue
      if (fullKey.includes('/incoming/')) continue
      const rel = fullKey.slice(folder.length + 1)
      if (!rel || rel.includes('/')) continue
      if (!IMAGE_EXT.test(rel)) continue
      keys.push(fullKey)
    }
    if (!batch.hasNext || !batch.nextCursor) break
    cursor = batch.nextCursor
  }
  return [...new Set(keys)]
}

function objectKeysFromV1ListRows(
  folder: string,
  rows: { id: string | null; name: string; metadata?: { mimetype?: string } | null }[],
): string[] {
  const candidates = rows.filter((row) => row.name && isHeroImageRowName(row.name))
  const strict = candidates.filter(
    (row) => row.id != null || (typeof row.metadata?.mimetype === 'string' && row.metadata.mimetype.startsWith('image/')),
  )
  /** 일부 행만 id/mimetype이 있으면 strict가 1건 등으로 줄어들어 나머지 이미지가 통째로 빠지는 문제 방지 */
  const picked = strict.length > 0 && strict.length === candidates.length ? strict : candidates
  return picked.map((row) => rowNameToObjectKey(folder, row.name))
}

async function listHeroObjectKeysViaV1Paginated(
  bucketApi: ReturnType<SupabaseClient['storage']['from']>,
  folder: string,
): Promise<string[]> {
  const collected = new Map<string, true>()
  const pageSize = 500
  const maxPages = 25

  for (const path of [folder, `${folder}/`]) {
    const listPath = path === '' ? undefined : path
    for (let page = 0; page < maxPages; page++) {
      const offset = page * pageSize
      const listOnce = async (withSort: boolean) =>
        bucketApi.list(listPath, {
          limit: pageSize,
          offset,
          ...(withSort ? { sortBy: { column: 'name', order: 'asc' as const } } : {}),
        })

      let { data, error } = await listOnce(true)
      if (error) ({ data, error } = await listOnce(false))
      if (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[private-trip-hero] Supabase Storage list (v1)', listPath, offset, error)
        }
        break
      }
      const rows = data ?? []
      if (rows.length === 0) break
      for (const key of objectKeysFromV1ListRows(folder, rows)) {
        if (key.includes('/incoming/')) continue
        collected.set(key, true)
      }
      if (rows.length < pageSize) break
    }
    if (collected.size > 0) break
  }

  return [...collected.keys()]
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

  /**
   * listV2만 쓰고 v1을 생략하면, 일부 Supabase/버킷 조합에서 v2가 1건만 주고 끝나는 경우가 있어
   * 화면은 1장만 돌아가는 것처럼 보인다. v1·v2를 항상 합쳐 키를 잡는다.
   */
  const v2Keys = await listHeroObjectKeysViaListV2(supabase, bucket, folder)
  const v1Keys = await listHeroObjectKeysViaV1Paginated(bucketApi, folder)
  const objectKeys = [...new Set([...v2Keys, ...v1Keys])]

  if (objectKeys.length === 0) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[private-trip-hero] Storage list returned 0 image keys', {
        bucket,
        prefix: `${folder}/`,
      })
    }
    return []
  }

  objectKeys.sort((a, b) => a.localeCompare(b, 'ko', { sensitivity: 'base' }))
  const publicUrls = objectKeys.map((key) => buildPublicUrlForObjectKey(key))
  if (process.env.PRIVATE_TRIP_HERO_PIPELINE_LOG === '1') {
    const uniqUrls = new Set(publicUrls)
    console.info(
      '[private-trip-hero-pipeline]',
      JSON.stringify({
        v2KeyCount: v2Keys.length,
        v1KeyCount: v1Keys.length,
        mergedKeyCount: objectKeys.length,
        publicUrlCount: publicUrls.length,
        uniquePublicUrlCount: uniqUrls.size,
      }),
    )
  }
  return publicUrls
}
