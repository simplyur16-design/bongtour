/**
 * 서버 이미지 업로드: Naver Cloud Object Storage(S3 호환) + sharp(WebP).
 * Env: NCLOUD_ACCESS_KEY, NCLOUD_SECRET_KEY, NCLOUD_OBJECT_STORAGE_ENDPOINT,
 * NCLOUD_OBJECT_STORAGE_BUCKET, NCLOUD_OBJECT_STORAGE_PUBLIC_BASE_URL,
 * 선택 NCLOUD_OBJECT_STORAGE_REGION(기본 kr-standard), NCLOUD_OBJECT_STORAGE_S3_ADDRESSING(기본 path; virtual이면 virtual-hosted).
 *
 * 브라우저→Supabase incoming 등 레거시 경로는 `getSupabaseImageStorageBucket` + `isSupabaseStorageAdminConfigured`를 사용한다.
 */
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { createHash } from 'node:crypto'
import sharp from 'sharp'

const DEFAULT_NCLOUD_BUCKET = 'bongtour'
const DEFAULT_SUPABASE_IMAGE_BUCKET = 'bongtour-images'

let s3Client: S3Client | null = null

function getS3Client(): S3Client {
  if (!s3Client) {
    const addressing = (process.env.NCLOUD_OBJECT_STORAGE_S3_ADDRESSING ?? 'path').toLowerCase().trim()
    const forcePathStyle = addressing !== 'virtual'
    const region = process.env.NCLOUD_OBJECT_STORAGE_REGION?.trim() || 'kr-standard'
    const endpoint = process.env.NCLOUD_OBJECT_STORAGE_ENDPOINT!.trim()
    s3Client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId: process.env.NCLOUD_ACCESS_KEY!.trim(),
        secretAccessKey: process.env.NCLOUD_SECRET_KEY!.trim(),
      },
      forcePathStyle,
    })
  }
  return s3Client
}

/** 앱·DB에 기록되는 객체 스토리지 버킷(네이버 클라우드). */
export function getImageStorageBucket(): string {
  return process.env.NCLOUD_OBJECT_STORAGE_BUCKET?.trim() || DEFAULT_NCLOUD_BUCKET
}

/** Supabase Storage API(직접 업로드·incoming 등) 전용 버킷명. */
export function getSupabaseImageStorageBucket(): string {
  return process.env.SUPABASE_IMAGE_BUCKET?.trim() || DEFAULT_SUPABASE_IMAGE_BUCKET
}

export function isObjectStorageConfigured(): boolean {
  return Boolean(
    process.env.NCLOUD_ACCESS_KEY?.trim() &&
      process.env.NCLOUD_SECRET_KEY?.trim() &&
      process.env.NCLOUD_OBJECT_STORAGE_ENDPOINT?.trim() &&
      process.env.NCLOUD_OBJECT_STORAGE_BUCKET?.trim() &&
      process.env.NCLOUD_OBJECT_STORAGE_PUBLIC_BASE_URL?.trim(),
  )
}

/** Supabase 서비스 롤로 Storage API 호출 가능 여부(incoming·bootstrap 등). */
export function isSupabaseStorageAdminConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

export type ObjectStorageEnv = {
  bucket: string
  publicBaseUrl: string
}

export function getObjectStorageEnv(): ObjectStorageEnv {
  if (!isObjectStorageConfigured()) {
    throw new Error(
      'Ncloud Object Storage env가 불완전합니다. NCLOUD_ACCESS_KEY, NCLOUD_SECRET_KEY, NCLOUD_OBJECT_STORAGE_ENDPOINT, NCLOUD_OBJECT_STORAGE_BUCKET, NCLOUD_OBJECT_STORAGE_PUBLIC_BASE_URL을 설정하세요.',
    )
  }
  const bucket = getImageStorageBucket()
  const publicBaseUrl = process.env.NCLOUD_OBJECT_STORAGE_PUBLIC_BASE_URL!.trim().replace(/\/+$/, '')
  return { bucket, publicBaseUrl }
}

export function buildPublicUrlForObjectKey(objectKey: string): string {
  const { publicBaseUrl } = getObjectStorageEnv()
  const key = objectKey.replace(/^\/+/, '')
  const encoded = key
    .split('/')
    .map((seg) => {
      try {
        return encodeURIComponent(decodeURIComponent(seg))
      } catch {
        return encodeURIComponent(seg)
      }
    })
    .join('/')
  return `${publicBaseUrl}/${encoded}`
}

export type UploadStorageObjectResult = {
  objectKey: string
  publicUrl: string
  bucket: string
}

function primaryMimeType(contentType: string): string {
  return (contentType || '').split(';')[0]?.trim().toLowerCase() || ''
}

/** 마지막 경로 세그먼트의 확장자를 `.webp`로 바꾼다(없으면 `<name>.webp`). */
function replaceStorageObjectKeyExtensionWithWebp(objectKey: string): string {
  const key = objectKey.replace(/^\/+/, '')
  const lastSlash = key.lastIndexOf('/')
  const dir = lastSlash >= 0 ? key.slice(0, lastSlash + 1) : ''
  const file = lastSlash >= 0 ? key.slice(lastSlash + 1) : key
  const dot = file.lastIndexOf('.')
  const base = dot >= 0 ? file.slice(0, dot) : file
  return `${dir}${base}.webp`
}

/**
 * 이미지면 sharp로 리사이즈·WebP(품질 82, 최대 너비 1920) 후 업로드.
 * GIF·애니 WebP는 그대로, SVG는 건드리지 않음. 실패 시 원본 업로드(안전망).
 */
async function prepareImageBodyForUpload(params: {
  objectKey: string
  body: Buffer
  contentType: string
}): Promise<{ objectKey: string; body: Buffer; contentType: string }> {
  const mime = primaryMimeType(params.contentType)
  let objectKey = params.objectKey.replace(/^\/+/, '')
  const { body, contentType } = params

  if (!mime.startsWith('image/')) {
    return { objectKey, body, contentType }
  }
  if (mime === 'image/svg+xml') {
    return { objectKey, body, contentType }
  }
  if (mime === 'image/gif') {
    return { objectKey, body, contentType }
  }

  try {
    const meta = await sharp(body).metadata()
    if (meta.format === 'gif') {
      return { objectKey, body, contentType }
    }
    if (meta.format === 'webp' && (meta.pages ?? 1) > 1) {
      return { objectKey, body, contentType }
    }

    const out = await sharp(body)
      .rotate()
      .resize({ width: 1920, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer()

    return {
      objectKey: replaceStorageObjectKeyExtensionWithWebp(objectKey),
      body: out,
      contentType: 'image/webp',
    }
  } catch (err) {
    console.warn('[object-storage] upload image optimize failed, using original bytes', {
      objectKey,
      contentType,
      message: err instanceof Error ? err.message : String(err),
    })
    return { objectKey, body, contentType }
  }
}

export async function uploadStorageObject(params: {
  objectKey: string
  body: Buffer
  contentType: string
}): Promise<UploadStorageObjectResult> {
  const { bucket, publicBaseUrl } = getObjectStorageEnv()
  const prepared = await prepareImageBodyForUpload(params)
  const key = prepared.objectKey.replace(/^\/+/, '')
  const client = getS3Client()
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: prepared.body,
      ContentType: prepared.contentType,
      ACL: 'public-read',
    }),
  )
  const publicUrl = buildPublicUrlForObjectKey(key)
  return { objectKey: key, publicUrl, bucket }
}

export async function removeStorageObject(objectKey: string): Promise<void> {
  const { bucket } = getObjectStorageEnv()
  const key = objectKey.replace(/^\/+/, '')
  const client = getS3Client()
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}

export type ListedStorageObject = {
  objectKey: string
  created_at?: string
  updated_at?: string
}

/**
 * `prefix` 아래 객체 키를 평면 나열(ListObjectsV2). (폴더 개념 없음 — S3 prefix 매칭)
 */
export async function listStorageObjectKeysRecursive(params: {
  prefix: string
  maxKeys?: number
  /** Supabase 재귀 목록 호환용 — S3에서는 무시됨 */
  maxDepth?: number
}): Promise<{ objects: ListedStorageObject[]; truncated: boolean }> {
  const { bucket } = getObjectStorageEnv()
  const maxKeys = params.maxKeys ?? 100_000
  const prefix = params.prefix.replace(/^\/+/, '')
  const client = getS3Client()
  const objects: ListedStorageObject[] = []
  let truncated = false
  let continuationToken: string | undefined

  for (;;) {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: Math.min(1000, maxKeys - objects.length),
      }),
    )
    for (const item of res.Contents ?? []) {
      if (!item.Key) continue
      objects.push({
        objectKey: item.Key,
        updated_at: item.LastModified?.toISOString(),
      })
      if (objects.length >= maxKeys) {
        truncated = Boolean(res.IsTruncated)
        return { objects, truncated }
      }
    }
    if (!res.IsTruncated || !res.NextContinuationToken) break
    continuationToken = res.NextContinuationToken
  }

  return { objects, truncated }
}

export type RemoveStorageBatchResult = {
  removed: string[]
  failed: { key: string; message: string }[]
}

/** 여러 객체 삭제(S3 DeleteObjects, 실패 시 단건 DeleteObject 폴백). */
export async function removeStorageObjectsBatched(
  keys: string[],
  opts?: { batchSize?: number },
): Promise<RemoveStorageBatchResult> {
  const batchSize = Math.min(opts?.batchSize ?? 1000, 1000)
  const { bucket } = getObjectStorageEnv()
  const client = getS3Client()
  const normalized = [...new Set(keys.map((k) => k.replace(/^\/+/, '')))].filter(Boolean)
  const removed: string[] = []
  const failed: { key: string; message: string }[] = []

  async function removeOne(key: string): Promise<boolean> {
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
      removed.push(key)
      return true
    } catch (e) {
      failed.push({ key, message: e instanceof Error ? e.message : String(e) })
      return false
    }
  }

  for (let i = 0; i < normalized.length; i += batchSize) {
    const chunk = normalized.slice(i, i + batchSize)
    try {
      const out = await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
        }),
      )
      const errByKey = new Map<string, string>()
      for (const er of out.Errors ?? []) {
        if (er.Key) errByKey.set(er.Key, er.Message ?? 'DeleteObjects error')
      }
      for (const key of chunk) {
        if (errByKey.has(key)) {
          try {
            await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
            removed.push(key)
          } catch (e2) {
            failed.push({
              key,
              message: errByKey.get(key) ?? (e2 instanceof Error ? e2.message : String(e2)),
            })
          }
        } else {
          removed.push(key)
        }
      }
    } catch {
      for (const key of chunk) {
        await removeOne(key)
      }
    }
  }

  return { removed, failed }
}

function decodeKeyPath(raw: string): string {
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
}

export function tryParseObjectKeyFromPublicUrl(publicUrl: string): string | null {
  try {
    let u = publicUrl.trim()
    const q = u.indexOf('?')
    if (q >= 0) u = u.slice(0, q)

    if (isObjectStorageConfigured()) {
      const base = getObjectStorageEnv().publicBaseUrl.replace(/\/+$/, '')
      if (u.startsWith(`${base}/`) || u === base) {
        const raw = u.slice(base.length).replace(/^\/+/, '')
        if (!raw) return null
        return decodeKeyPath(raw)
      }
    }

    const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/+$/, '')
    const supBucket = getSupabaseImageStorageBucket()
    if (supabaseUrl) {
      const legacy = `${supabaseUrl}/storage/v1/object/public/${supBucket}`
      const lb = legacy.replace(/\/+$/, '')
      if (u.startsWith(`${lb}/`) || u === lb) {
        const raw = u.slice(lb.length).replace(/^\/+/, '')
        if (!raw) return null
        return decodeKeyPath(raw)
      }
    }
  } catch {
    return null
  }
  return null
}

export function buildGeminiGeneratedObjectKey(now: Date, baseId: string, slot: string, index: number): string {
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
