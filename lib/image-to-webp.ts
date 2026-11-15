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

/**
 * 상품 사진 저장 공통: WebP로 줄여 maxBytes 이하가 될 때까지 화질·가로를 낮춘다.
 * 가로 1200 미만으로는 내리지 않는다(기존 저화질 거절과 맞춤). 그래도 넘으면 null(저장 거부).
 */
export async function fitProductPhotoToMaxBytes(
  inputBuffer: Buffer,
  opts: { maxBytes: number; maxWidth?: number; quality?: number },
): Promise<{ buffer: Buffer; width: number; height: number } | null> {
  const maxBytes = opts.maxBytes
  if (!(maxBytes > 0)) return null
  const widths = [opts.maxWidth ?? 2400, 1600, 1200].filter((w, i, arr) => w >= 1200 && arr.indexOf(w) === i)
  const qualities = [opts.quality ?? 88, 70, 55].filter((q, i, arr) => arr.indexOf(q) === i)
  let best: { buffer: Buffer; width: number; height: number } | null = null
  for (const maxWidth of widths) {
    for (const quality of qualities) {
      const out = await convertToWebp(inputBuffer, { maxWidth, quality })
      if (!best || out.buffer.length < best.buffer.length) best = out
      if (out.buffer.length <= maxBytes) return out
    }
  }
  return best && best.buffer.length <= maxBytes ? best : null
}
