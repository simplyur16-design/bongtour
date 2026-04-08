/**
 * 이미지 Buffer를 WebP로 변환해 용량 줄이기 (sharp 사용)
 */

import sharp from 'sharp'

export type WebpOptions = {
  /** 최대 가로 픽셀 (비율 유지). 없으면 리사이즈 안 함 */
  maxWidth?: number
  /** WebP 품질 1–100 (기본 82, 용량·화질 균형) */
  quality?: number
}

const DEFAULT_QUALITY = 82
const DEFAULT_MAX_WIDTH = 1600

/**
 * 입력 이미지(Buffer)를 WebP로 변환하고 용량을 줄여 Buffer 반환
 */
export async function convertToWebp(
  inputBuffer: Buffer,
  options: WebpOptions = {}
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const quality = Math.min(100, Math.max(1, options.quality ?? DEFAULT_QUALITY))
  const maxWidth = options.maxWidth ?? DEFAULT_MAX_WIDTH

  const pipeline = sharp(inputBuffer)
  const meta = await pipeline.metadata()
  const w = meta.width ?? 0
  const h = meta.height ?? 0

  let pipe = pipeline.rotate() // EXIF orientation
  if (maxWidth > 0 && w > maxWidth) {
    pipe = pipe.resize({ width: maxWidth, withoutEnlargement: true })
  }

  const buffer = await pipe
    .webp({ quality, effort: 4 })
    .toBuffer()

  const outMeta = await sharp(buffer).metadata()
  return {
    buffer,
    width: outMeta.width ?? w,
    height: outMeta.height ?? h,
  }
}
