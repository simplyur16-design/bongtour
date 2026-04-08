/**
 * Ncloud Object Storage (S3 호환 API). 서버 전용 — 키는 클라이언트에 노출하지 않는다.
 * @see https://guide.ncloud-docs.com/docs/storage-storage-8-2
 */

import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

let cachedS3: { sig: string; client: S3Client } | null = null

export type NcloudObjectStorageEnv = {
  accessKey: string
  secretKey: string
  endpoint: string
  region: string
  bucket: string
  publicBaseUrl: string
  /** path: `kr.object...` + forcePathStyle true (기본). virtual: 문서의 `{Bucket}.kr.ncloudstorage.com` + forcePathStyle false */
  s3Addressing: 'path' | 'virtual'
}

function trimEnv(name: string): string {
  return process.env[name]?.trim() ?? ''
}

/** 운영·스크립트에서 동일 규칙으로 사용 */
export function isNcloudObjectStorageConfigured(): boolean {
  try {
    getNcloudObjectStorageEnv()
    return true
  } catch {
    return false
  }
}

function readS3Addressing(): 'path' | 'virtual' {
  const v = trimEnv('NCLOUD_OBJECT_STORAGE_S3_ADDRESSING').toLowerCase()
  if (v === 'virtual' || v === 'vhost') return 'virtual'
  return 'path'
}

/**
 * 가상 호스트 스타일: S3 클라이언트가 `Bucket` 을 서브도메인으로 붙임.
 * 엔드포인트는 리전 베이스만 (`Host` 예시: `kr.ncloudstorage.com`). 버킷을 URL에 넣으면 이중으로 붙는다.
 */
function virtualHostEndpoint(): string {
  const regionCode = trimEnv('NCLOUD_OBJECT_STORAGE_REGION_CODE') || 'kr'
  return `https://${regionCode}.ncloudstorage.com`
}

export function getNcloudObjectStorageEnv(): NcloudObjectStorageEnv {
  const accessKey = trimEnv('NCLOUD_ACCESS_KEY')
  const secretKey = trimEnv('NCLOUD_SECRET_KEY')
  const endpoint = trimEnv('NCLOUD_OBJECT_STORAGE_ENDPOINT')
  const region = trimEnv('NCLOUD_OBJECT_STORAGE_REGION')
  const bucket = trimEnv('NCLOUD_OBJECT_STORAGE_BUCKET') || 'bongtour'
  const publicBaseUrl = trimEnv('NCLOUD_OBJECT_STORAGE_PUBLIC_BASE_URL')
  const s3Addressing = readS3Addressing()
  if (!accessKey || !secretKey || !region || !publicBaseUrl) {
    throw new Error(
      'Ncloud Object Storage 환경 변수가 불완전합니다. NCLOUD_ACCESS_KEY, NCLOUD_SECRET_KEY, NCLOUD_OBJECT_STORAGE_REGION, NCLOUD_OBJECT_STORAGE_PUBLIC_BASE_URL (및 선택 NCLOUD_OBJECT_STORAGE_BUCKET) 를 설정하세요.'
    )
  }
  if (s3Addressing === 'path' && !endpoint) {
    throw new Error(
      'NCLOUD_OBJECT_STORAGE_S3_ADDRESSING=path 일 때 NCLOUD_OBJECT_STORAGE_ENDPOINT 가 필요합니다.'
    )
  }
  return { accessKey, secretKey, endpoint, region, bucket, publicBaseUrl, s3Addressing }
}

function resolveS3EndpointAndStyle(env: NcloudObjectStorageEnv): { endpoint: string; forcePathStyle: boolean } {
  if (env.s3Addressing === 'virtual') {
    return { endpoint: virtualHostEndpoint(), forcePathStyle: false }
  }
  return { endpoint: env.endpoint, forcePathStyle: true }
}

/** 진단·테스트: 실제 S3 클라이언트에 쓰는 endpoint / path|virtual */
export function getNcloudS3ResolvedConfig(): {
  endpoint: string
  forcePathStyle: boolean
  s3Addressing: 'path' | 'virtual'
  signingRegion: string
} {
  const env = getNcloudObjectStorageEnv()
  const { endpoint, forcePathStyle } = resolveS3EndpointAndStyle(env)
  return {
    endpoint,
    forcePathStyle,
    s3Addressing: env.s3Addressing,
    signingRegion: signingRegionForS3(env),
  }
}

/** `uploadNcloudObject` 와 동일 구성의 S3 클라이언트 */
export function getNcloudS3Client(): S3Client {
  return getS3Client()
}

function signingRegionForS3(env: NcloudObjectStorageEnv): string {
  if (env.s3Addressing === 'virtual') {
    return trimEnv('NCLOUD_OBJECT_STORAGE_REGION_CODE') || 'kr'
  }
  return env.region
}

function getS3Client(): S3Client {
  const full = getNcloudObjectStorageEnv()
  const { accessKey, secretKey } = full
  const { endpoint, forcePathStyle } = resolveS3EndpointAndStyle(full)
  const region = signingRegionForS3(full)
  const sig = `${endpoint}|${forcePathStyle}|${region}|${accessKey}`
  if (cachedS3?.sig === sig) return cachedS3.client
  const client = new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
    forcePathStyle,
  })
  cachedS3 = { sig, client }
  return client
}

/**
 * 공개 브라우저 URL. `NCLOUD_OBJECT_STORAGE_PUBLIC_BASE_URL` 에 슬래시 없이 object key 를 붙인다.
 * path 세그먼트는 encodeURIComponent 처리.
 */
export function buildNcloudPublicUrl(publicBaseUrl: string, objectKey: string): string {
  const base = publicBaseUrl.replace(/\/+$/, '')
  const key = objectKey
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join('/')
  return `${base}/${key}`
}

/** 예: gemini/generated/2026/04/{baseId}-no_person_wide-0.webp */
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

export type UploadNcloudObjectResult = {
  objectKey: string
  publicUrl: string
  bucket: string
}

/**
 * 버퍼를 Object Storage에 업로드. 버킷은 공개 읽기 정책이어야 브라우저에서 URL로 열 수 있다.
 */
export async function uploadNcloudObject(params: {
  objectKey: string
  body: Buffer
  contentType: string
}): Promise<UploadNcloudObjectResult> {
  const env = getNcloudObjectStorageEnv()
  const client = getS3Client()
  const Key = params.objectKey.replace(/^\/+/, '')
  await client.send(
    new PutObjectCommand({
      Bucket: env.bucket,
      Key,
      Body: params.body,
      ContentType: params.contentType,
    })
  )
  const publicUrl = buildNcloudPublicUrl(env.publicBaseUrl, Key)
  return { objectKey: Key, publicUrl, bucket: env.bucket }
}

/** 업로드 실패 시 DB 롤백용 또는 삭제 작업 */
export async function removeNcloudObject(objectKey: string): Promise<void> {
  const env = getNcloudObjectStorageEnv()
  const client = getS3Client()
  const Key = objectKey.replace(/^\/+/, '')
  await client.send(new DeleteObjectCommand({ Bucket: env.bucket, Key }))
}

/** 사진풀: `buildWebpFilename` 결과 파일명 기준 (예: `photo-pool/Osaka_OsakaCastle_Pexels.webp`) */
export function buildPhotoPoolObjectKey(filename: string): string {
  const safe = filename.replace(/^\/+/, '').replace(/\.\./g, '')
  return `photo-pool/${safe}`
}

export function buildMonthlyCurationObjectKey(filename: string): string {
  const safe = filename.replace(/^\/+/, '').replace(/\.\./g, '')
  return `monthly-curation/${safe}`
}

export function buildEditorialObjectKey(filename: string): string {
  const safe = filename.replace(/^\/+/, '').replace(/\.\./g, '')
  return `editorial-content/${safe}`
}

/** 홈 허브 후보: id 기반 고유 키 */
export function buildHomeHubCandidateObjectKey(candidateId: string): string {
  const safe = candidateId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120)
  return `home-hub/candidates/${safe}.webp`
}

/**
 * 공개 URL이 이 프로젝트 Ncloud `NCLOUD_OBJECT_STORAGE_PUBLIC_BASE_URL` 하위면 object key 반환.
 * 로컬 `/uploads/...` 또는 타 호스트는 null.
 */
export function tryParseObjectKeyFromPublicUrl(publicUrl: string): string | null {
  const u = publicUrl.trim()
  if (!u.startsWith('http://') && !u.startsWith('https://')) return null
  if (!isNcloudObjectStorageConfigured()) return null
  try {
    const env = getNcloudObjectStorageEnv()
    const base = env.publicBaseUrl.replace(/\/+$/, '')
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
