import { randomUUID } from 'crypto'
import {
  PRIVATE_TRIP_HERO_STORAGE_PREFIX,
  PRIVATE_TRIP_HERO_UPLOAD_MAX_BYTES,
} from '@/lib/private-trip-hero-constants'
import { processPrivateTripHeroImageToWebpCover, saveProcessedPrivateTripHeroWebp } from '@/lib/private-trip-hero-upload'
import {
  createPresignedPutUrl,
  isObjectStorageConfigured,
  readStorageObject,
  removeStorageObject,
} from '@/lib/object-storage'

const INCOMING = `${PRIVATE_TRIP_HERO_STORAGE_PREFIX}/incoming`

/** 직접 업로드 경로를 켤 수 있는지(폴더 API·관리자 UI 플래그) — Ncloud Object Storage 설정 시 true */
export function isPrivateTripHeroDirectBrowserUploadConfigured(): boolean {
  return isObjectStorageConfigured()
}

const ALLOWED_SIGN_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/heic',
  'image/heif',
])

function extForMime(mime: string): string {
  const m = mime.toLowerCase().split(';')[0]!.trim()
  if (m === 'image/jpeg' || m === 'image/jpg') return 'jpg'
  if (m === 'image/png') return 'png'
  if (m === 'image/webp') return 'webp'
  if (m === 'image/gif') return 'gif'
  if (m === 'image/avif') return 'avif'
  if (m === 'image/heic' || m === 'image/heif') return 'heic'
  return 'bin'
}

/** `private-trip-hero/incoming/<id>.<ext>` — 경로 조작 방지 */
const INCOMING_PATH = /^private-trip-hero\/incoming\/[^/]+\.[a-z0-9]+$/i

/**
 * 관리자 전용: 임시 incoming 객체에 대한 presigned PUT URL 발급 (Ncloud).
 */
export async function signPrivateTripHeroIncomingUpload(params: {
  byteLength: number
  mimeType: string
}): Promise<{ incomingPath: string; uploadUrl: string; contentType: string }> {
  if (!isObjectStorageConfigured()) {
    throw new Error(
      'Ncloud Object Storage(NCLOUD_ACCESS_KEY, NCLOUD_SECRET_KEY, NCLOUD_OBJECT_STORAGE_ENDPOINT, NCLOUD_OBJECT_STORAGE_BUCKET, NCLOUD_OBJECT_STORAGE_PUBLIC_BASE_URL)가 설정되어 있지 않습니다.',
    )
  }
  if (params.byteLength <= 0 || params.byteLength > PRIVATE_TRIP_HERO_UPLOAD_MAX_BYTES) {
    throw new Error(`파일은 ${Math.round(PRIVATE_TRIP_HERO_UPLOAD_MAX_BYTES / 1024 / 1024)}MB 이하여야 합니다.`)
  }

  let mime = (params.mimeType || '').toLowerCase().split(';')[0]!.trim()
  if (mime === 'image/jpg') mime = 'image/jpeg'
  if (!mime || !ALLOWED_SIGN_MIME.has(mime)) {
    throw new Error('jpg, png, webp, gif, avif, heic 등 이미지 형식만 업로드할 수 있습니다.')
  }

  const id = randomUUID()
  const ext = extForMime(params.mimeType || 'application/octet-stream')
  const incomingPath = `${INCOMING}/${id}.${ext}`

  const { url } = await createPresignedPutUrl({
    key: incomingPath,
    contentType: mime,
    expiresInSeconds: 600,
  })

  return { incomingPath, uploadUrl: url, contentType: mime }
}

/**
 * incoming에 올라간 원본을 받아 WebP로 변환·최종 키에 저장한 뒤 incoming을 삭제한다.
 */
export async function finalizePrivateTripHeroIncomingUpload(incomingPath: string, originalFileName: string): Promise<{
  fileName: string
  publicUrl: string
  bytesWritten: number
}> {
  if (!INCOMING_PATH.test(incomingPath)) {
    throw new Error('잘못된 incoming 경로입니다.')
  }

  let buffer: Buffer
  try {
    buffer = await readStorageObject(incomingPath)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const missing =
      /NoSuchKey|not exist|does not exist|404|NotFound/i.test(msg) || msg.includes('Object not found')
    throw new Error(missing ? '임시 파일을 읽지 못했습니다.' : msg)
  }

  if (buffer.length === 0) {
    throw new Error('빈 파일입니다.')
  }

  let webp: Buffer
  try {
    webp = await processPrivateTripHeroImageToWebpCover(buffer)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await removeStorageObject(incomingPath).catch(() => {})
    throw new Error(`이미지 처리 실패: ${msg}`)
  }

  const saved = await saveProcessedPrivateTripHeroWebp(webp, originalFileName || 'upload')
  await removeStorageObject(incomingPath).catch((err) => {
    console.warn('[private-trip-hero] incoming 삭제 실패(무시 가능):', incomingPath, err)
  })

  return saved
}
