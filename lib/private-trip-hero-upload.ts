import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import {
  getPrivateTripHeroFolderAbsPath,
  listPrivateTripHeroFolderImagePublicUrls,
  PRIVATE_TRIP_HERO_FOLDER_PUBLIC,
} from '@/lib/private-trip-hero-folder'

/** 우리여행 히어로 이미지 영역에 맞춘 와이드 비율(가로:세로 ≈ 3:1), `object-cover`와 유사하게 중앙 크롭 */
export const PRIVATE_TRIP_HERO_COVER_WIDTH = 1920
export const PRIVATE_TRIP_HERO_COVER_HEIGHT = 640
export const PRIVATE_TRIP_HERO_WEBP_QUALITY = 80
export const PRIVATE_TRIP_HERO_UPLOAD_MAX_BYTES = 30 * 1024 * 1024

const MAX_FOLDER_FILES = 500

function safeFileStem(originalName: string): string {
  const base = path.basename(originalName || 'upload', path.extname(originalName || ''))
  const cleaned = base.replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
  return cleaned.slice(0, 48) || 'hero'
}

/**
 * 원본 버퍼 → EXIF 보정 → 고정 프레임에 맞게 cover 리사이즈 → WebP (용량·형식 통일)
 */
export async function processPrivateTripHeroImageToWebpCover(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
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
 * 처리된 WebP를 전용 폴더에 저장하고 공개 URL을 반환한다.
 */
export async function saveProcessedPrivateTripHeroWebp(
  webpBuffer: Buffer,
  originalFileName: string,
): Promise<SavePrivateTripHeroUploadResult> {
  const current = listPrivateTripHeroFolderImagePublicUrls().length
  if (current >= MAX_FOLDER_FILES) {
    throw new Error(`전용 폴더 이미지는 최대 ${MAX_FOLDER_FILES}장까지입니다. 기존 파일을 지운 뒤 다시 시도하세요.`)
  }

  const dir = getPrivateTripHeroFolderAbsPath()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const stem = safeFileStem(originalFileName)
  const fileName = `${stem}-${randomUUID().slice(0, 10)}.webp`
  const abs = path.join(dir, fileName)
  fs.writeFileSync(abs, webpBuffer)

  return {
    fileName,
    publicUrl: `${PRIVATE_TRIP_HERO_FOLDER_PUBLIC}/${encodeURIComponent(fileName)}`,
    bytesWritten: webpBuffer.length,
  }
}
