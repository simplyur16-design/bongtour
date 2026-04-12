import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import {
  PRIVATE_TRIP_HERO_COVER_HEIGHT,
  PRIVATE_TRIP_HERO_COVER_WIDTH,
  PRIVATE_TRIP_HERO_FOLDER_PUBLIC,
  PRIVATE_TRIP_HERO_WEBP_QUALITY,
} from '@/lib/private-trip-hero-constants'
import {
  getPrivateTripHeroFolderAbsPath,
  listPrivateTripHeroFolderImagePublicUrls,
} from '@/lib/private-trip-hero-folder'

const MAX_FOLDER_FILES = 500

/**
 * 디스크·URL 경로 모두 안전한 ASCII 파일명만 사용 (nginx 정적 경로·퍼센트 인코딩 불일치 방지).
 */
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

/**
 * 원본 버퍼 → EXIF 보정 → 고정 프레임에 맞게 cover 리사이즈 → WebP (용량·형식 통일)
 */
export async function processPrivateTripHeroImageToWebpCover(input: Buffer): Promise<Buffer> {
  // 큰 PNG(예: AI 생성 원본)는 한 번에 디코드·cover 하면 메모리·시간이 튈 수 있어 먼저 긴 변을 제한한다.
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

  const fileName = asciiHeroFileName(originalFileName)
  const abs = path.join(dir, fileName)
  fs.writeFileSync(abs, webpBuffer)

  return {
    fileName,
    publicUrl: `${PRIVATE_TRIP_HERO_FOLDER_PUBLIC}/${fileName}`,
    bytesWritten: webpBuffer.length,
  }
}
