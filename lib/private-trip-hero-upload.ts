import { randomUUID } from 'crypto'
import path from 'path'
import sharp from 'sharp'
import {
  PRIVATE_TRIP_HERO_COVER_HEIGHT,
  PRIVATE_TRIP_HERO_COVER_WIDTH,
  PRIVATE_TRIP_HERO_STORAGE_PREFIX,
  PRIVATE_TRIP_HERO_WEBP_QUALITY,
} from '@/lib/private-trip-hero-constants'
import { isObjectStorageConfigured, uploadStorageObject } from '@/lib/object-storage'
import { listPrivateTripHeroStoragePublicUrls } from '@/lib/private-trip-hero-supabase'

const MAX_FOLDER_FILES = 500

function asciiHeroFileName(originalName: string): string {
  const base = path.basename(originalName || 'upload', path.extname(originalName || ''))
  const ascii = base
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 32)
  const stem = ascii || 'hero'
  return `${stem}-${randomUUID().slice(0, 10)}.webp`
}

export async function processPrivateTripHeroImageToWebpCover(input: Buffer): Promise<Buffer> {
  return sharp(input, { sequentialRead: true })
    .rotate()
    .resize(4096, 4096, { fit: 'inside', withoutEnlargement: true })
    .resize(PRIVATE_TRIP_HERO_COVER_WIDTH, PRIVATE_TRIP_HERO_COVER_HEIGHT, {
      fit: 'cover',
      position: 'centre',
    })
    .webp({ quality: PRIVATE_TRIP_HERO_WEBP_QUALITY, effort: 4 })
    .toBuffer()
}

export type SavePrivateTripHeroUploadResult = {
  fileName: string
  publicUrl: string
  bytesWritten: number
}

/**
 * 처리된 WebP를 Supabase Storage `private-trip-hero/` 에만 저장한다.
 * (공개·관리자 모두 Storage-only)
 */
export async function saveProcessedPrivateTripHeroWebp(
  webpBuffer: Buffer,
  originalFileName: string,
): Promise<SavePrivateTripHeroUploadResult> {
  if (!isObjectStorageConfigured()) {
    throw new Error(
      'Supabase Storage가 설정되어 있지 않습니다. 우리여행 히어로 이미지는 Storage에만 저장됩니다. (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)',
    )
  }

  const current = (await listPrivateTripHeroStoragePublicUrls()).length
  if (current >= MAX_FOLDER_FILES) {
    throw new Error(
      `우리여행 히어로 이미지는 최대 ${MAX_FOLDER_FILES}장까지입니다. Storage에서 기존 파일을 지운 뒤 다시 시도하세요.`,
    )
  }

  const fileName = asciiHeroFileName(originalFileName)
  const objectKey = `${PRIVATE_TRIP_HERO_STORAGE_PREFIX}/${fileName}`
  const { publicUrl } = await uploadStorageObject({
    objectKey,
    body: webpBuffer,
    contentType: 'image/webp',
  })

  return {
    fileName,
    publicUrl,
    bytesWritten: webpBuffer.length,
  }
}
