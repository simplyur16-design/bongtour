/**
 * Supabase Storage: server-side uploads. Use a public-read bucket in the Supabase dashboard.
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY; optional SUPABASE_IMAGE_BUCKET (default bongtour-images).
 */
import { createHash } from 'node:crypto'
import { getSupabaseAdmin } from './supabase-admin'

const DEFAULT_BUCKET = 'bongtour-images'

export function getImageStorageBucket(): string {
  return process.env.SUPABASE_IMAGE_BUCKET?.trim() || DEFAULT_BUCKET
}

export function isObjectStorageConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

export type ObjectStorageEnv = {
  bucket: string
  publicBaseUrl: string
}

export function getObjectStorageEnv(): ObjectStorageEnv {
  if (!isObjectStorageConfigured()) {
    throw new Error(
      'Supabase Storage env is incomplete. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and optional SUPABASE_IMAGE_BUCKET (default bongtour-images).'
    )
  }
  const supabaseUrl = process.env.SUPABASE_URL!.trim().replace(/\/+$/, '')
  const bucket = getImageStorageBucket()
  return {
    bucket,
    publicBaseUrl: `${supabaseUrl}/storage/v1/object/public/${bucket}`,
  }
}

export function buildPublicUrlForObjectKey(objectKey: string): string {
  const bucket = getImageStorageBucket()
  const supabase = getSupabaseAdmin()
  const key = objectKey.replace(/^\/+/, '')
  const { data } = supabase.storage.from(bucket).getPublicUrl(key)
  return data.publicUrl
}

export type UploadStorageObjectResult = {
  objectKey: string
  publicUrl: string
  bucket: string
}

export async function uploadStorageObject(params: {
  objectKey: string
  body: Buffer
  contentType: string
}): Promise<UploadStorageObjectResult> {
  const { bucket } = getObjectStorageEnv()
  const supabase = getSupabaseAdmin()
  const key = params.objectKey.replace(/^\/+/, '')
  const { error } = await supabase.storage.from(bucket).upload(key, params.body, {
    contentType: params.contentType,
    upsert: true,
  })
  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`)
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(key)
  return { objectKey: key, publicUrl: data.publicUrl, bucket }
}

export async function removeStorageObject(objectKey: string): Promise<void> {
  const { bucket } = getObjectStorageEnv()
  const supabase = getSupabaseAdmin()
  const key = objectKey.replace(/^\/+/, '')
  const { error } = await supabase.storage.from(bucket).remove([key])
  if (error) {
    throw new Error(`Supabase Storage delete failed: ${error.message}`)
  }
}

type StorageListRow = {
  name: string
  metadata?: { size?: number } | null
  created_at?: string
  updated_at?: string
}

function storageListRowIsFile(row: StorageListRow): boolean {
  return row.metadata != null && typeof row.metadata.size === 'number'
}

export type ListedStorageObject = {
  objectKey: string
  created_at?: string
  updated_at?: string
}

/**
 * 버킷 내 `prefix`(예: `cities`, `cities/da-nang`) 아래의 **파일** object key를 재귀 수집.
 * 폴더는 `metadata.size`가 없는 항목으로 간주하고 하위로 내려간다.
 */
export async function listStorageObjectKeysRecursive(params: {
  prefix: string
  maxKeys?: number
  maxDepth?: number
}): Promise<{ objects: ListedStorageObject[]; truncated: boolean }> {
  const { bucket } = getObjectStorageEnv()
  const supabase = getSupabaseAdmin()
  const maxKeys = params.maxKeys ?? 100_000
  const maxDepth = params.maxDepth ?? 24
  const root = params.prefix.replace(/^\/+/, '').replace(/\/+$/, '')
  const out: ListedStorageObject[] = []
  let truncated = false

  async function walk(rel: string, depth: number): Promise<void> {
    if (out.length >= maxKeys) {
      truncated = true
      return
    }
    if (depth > maxDepth) {
      truncated = true
      return
    }
    let offset = 0
    const pageSize = 1000
    for (;;) {
      if (out.length >= maxKeys) {
        truncated = true
        return
      }
      const { data, error } = await supabase.storage.from(bucket).list(rel, {
        limit: pageSize,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      })
      if (error) {
        throw new Error(`Supabase Storage list failed (${rel}): ${error.message}`)
      }
      const rows = (data ?? []) as StorageListRow[]
      if (rows.length === 0) break
      for (const row of rows) {
        if (out.length >= maxKeys) {
          truncated = true
          return
        }
        const name = row.name
        if (!name) continue
        const full = rel ? `${rel}/${name}` : name
        if (storageListRowIsFile(row)) {
          out.push({
            objectKey: full,
            created_at: row.created_at,
            updated_at: row.updated_at,
          })
        } else {
          await walk(full, depth + 1)
        }
      }
      if (rows.length < pageSize) break
      offset += pageSize
    }
  }

  await walk(root, 0)
  return { objects: out, truncated }
}

export type RemoveStorageBatchResult = {
  removed: string[]
  failed: { key: string; message: string }[]
}

/** 여러 객체 삭제. 배치 실패 시 청크 단위로 재시도 후 개별 폴백. */
export async function removeStorageObjectsBatched(
  keys: string[],
  opts?: { batchSize?: number }
): Promise<RemoveStorageBatchResult> {
  const batchSize = opts?.batchSize ?? 80
  const { bucket } = getObjectStorageEnv()
  const supabase = getSupabaseAdmin()
  const normalized = [...new Set(keys.map((k) => k.replace(/^\/+/, '')))].filter(Boolean)
  const removed: string[] = []
  const failed: { key: string; message: string }[] = []

  async function removeOne(key: string): Promise<boolean> {
    const { error } = await supabase.storage.from(bucket).remove([key])
    if (error) {
      failed.push({ key, message: error.message })
      return false
    }
    removed.push(key)
    return true
  }

  for (let i = 0; i < normalized.length; i += batchSize) {
    const chunk = normalized.slice(i, i + batchSize)
    const { error } = await supabase.storage.from(bucket).remove(chunk)
    if (!error) {
      removed.push(...chunk)
      continue
    }
    for (const key of chunk) {
      await removeOne(key)
    }
  }

  return { removed, failed }
}

export function tryParseObjectKeyFromPublicUrl(publicUrl: string): string | null {
  if (!isObjectStorageConfigured()) return null
  try {
    const { publicBaseUrl } = getObjectStorageEnv()
    const base = publicBaseUrl.replace(/\/+$/, '')
    let u = publicUrl.trim()
    const q = u.indexOf('?')
    if (q >= 0) u = u.slice(0, q)
    if (!u.startsWith(base)) return null
    const raw = u.slice(base.length).replace(/^\/+/, '')
    if (!raw) return null
    return raw
      .split('/')
      .map((seg) => {
        try {
          return decodeURIComponent(seg)
        } catch {
          return seg
        }
      })
      .join('/')
  } catch {
    return null
  }
}

export function buildGeminiGeneratedObjectKey(
  now: Date,
  baseId: string,
  slot: string,
  index: number
): string {
  const y = String(now.getUTCFullYear())
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const safeSlot = slot.replace(/[^a-zA-Z0-9_-]/g, '_')
  return `gemini/generated/${y}/${m}/${baseId}-${safeSlot}-${index}.webp`
}

/**
 * Supabase rejects non-ASCII object names ("Invalid key"). Logical names stay in app code; keys use ASCII + hash.
 */
export function toAsciiStorageFilename(logicalFilename: string): string {
  const trimmed = logicalFilename.replace(/^\/+/, '').replace(/\.\./g, '')
  const lastDot = trimmed.lastIndexOf('.')
  let ext = lastDot >= 0 ? trimmed.slice(lastDot) : '.webp'
  if (!/^\.[a-zA-Z0-9]+$/.test(ext) || ext.length > 12) ext = '.webp'
  const base = lastDot >= 0 ? trimmed.slice(0, lastDot) : trimmed
  const digest = createHash('sha256').update(trimmed, 'utf8').digest('hex').slice(0, 16)
  let ascii = base
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 96)
  if (!ascii) ascii = 'file'
  return `${ascii}__${digest}${ext}`
}

export function buildPhotoPoolObjectKey(filename: string): string {
  const safe = filename.replace(/^\/+/, '').replace(/\.\./g, '')
  return `photo-pool/${toAsciiStorageFilename(safe)}`
}

export function buildMonthlyCurationObjectKey(filename: string): string {
  const safe = filename.replace(/^\/+/, '').replace(/\.\./g, '')
  return `monthly-curation/${toAsciiStorageFilename(safe)}`
}

export function buildEditorialObjectKey(filename: string): string {
  const safe = filename.replace(/^\/+/, '').replace(/\.\./g, '')
  return `editorial-content/${toAsciiStorageFilename(safe)}`
}

export function buildHomeHubCandidateObjectKey(candidateId: string): string {
  const safe = candidateId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120)
  return `home-hub/candidates/${safe}.webp`
}
