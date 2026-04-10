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
