'use client'

import { resolveAdminUploadedImageMime } from '@/lib/admin-upload-image-mime'

const MAX_BEFORE_DECODE = 35 * 1024 * 1024

export type MonthlyCurationWebpPack = { blob: Blob; width: number; height: number }

/**
 * 시즌 추천 직접 업로드용 — 서버 `convertToWebp(maxWidth:1600, quality:82)`에 맞춘 브라우저 WebP.
 * jpg/png/webp만 허용(관리자 업로드 MIME 규칙과 동일 계열).
 */
export async function convertMonthlyCurationFileToWebp(file: File): Promise<MonthlyCurationWebpPack> {
  if (file.size > MAX_BEFORE_DECODE) {
    throw new Error('파일이 너무 큽니다. 더 작은 이미지를 선택해 주세요.')
  }
  const mime = resolveAdminUploadedImageMime(file)
  if (!mime) {
    throw new Error('jpg/png/webp만 업로드할 수 있습니다.')
  }

  const bitmap = await createImageBitmap(file)
  try {
    let { width, height } = bitmap
    const max = 1600
    if (width > max || height > max) {
      if (width >= height) {
        height = Math.round((height * max) / width)
        width = max
      } else {
        width = Math.round((width * max) / height)
        height = max
      }
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas를 사용할 수 없습니다.')
    ctx.drawImage(bitmap, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/webp', 0.82),
    )
    if (!blob || blob.size === 0) {
      throw new Error('WebP로 변환하지 못했습니다. 다른 이미지를 시도해 주세요.')
    }
    return { blob, width, height }
  } finally {
    bitmap.close()
  }
}
