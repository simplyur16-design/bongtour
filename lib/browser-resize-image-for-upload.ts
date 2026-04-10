/**
 * Client-side downscale + JPEG before multipart upload.
 * Avoids HTTP 413 on hosts with small request body limits (e.g. Vercel).
 * Pairs with `savePhotoToPool` server conversion (still accepts jpeg).
 */

export const BROWSER_UPLOAD_RESIZE_MAX_WIDTH = 1600
export const BROWSER_UPLOAD_JPEG_QUALITY = 0.82

export function resizeImageFileForUpload(
  file: File,
  maxWidth: number = BROWSER_UPLOAD_RESIZE_MAX_WIDTH,
  quality: number = BROWSER_UPLOAD_JPEG_QUALITY
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let w = img.width
      let h = img.height
      if (w > maxWidth) {
        h = Math.round((h * maxWidth) / w)
        w = maxWidth
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(
          new Error(
            '이 브라우저에서 이미지 리사이즈를 할 수 없습니다. 다른 브라우저에서 시도하거나 JPG/PNG로 저장해 업로드해 주세요.'
          )
        )
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('이미지 인코딩에 실패했습니다. JPG 또는 PNG 파일로 다시 시도해 주세요.'))
            return
          }
          const name = file.name.replace(/\.[^.]+$/i, '.jpg')
          resolve(new File([blob], name, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(
        new Error(
          '이미지를 열 수 없습니다. iPhone HEIC·RAW 등은 사진 앱에서 JPG로 보낸 뒤 업로드해 주세요.'
        )
      )
    }
    img.src = url
  })
}
