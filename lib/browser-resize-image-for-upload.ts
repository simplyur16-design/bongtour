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
  return new Promise((resolve) => {
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
        resolve(file)
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file)
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
      resolve(file)
    }
    img.src = url
  })
}
