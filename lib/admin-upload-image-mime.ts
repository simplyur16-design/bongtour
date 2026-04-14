/**
 * 브라우저/OS에 따라 `File.type`이 비거나 `application/octet-stream`인 경우가 있어
 * 확장자로 jpeg/png/webp를 보강한다. (CMS 시즌 추천·에디토리얼 업로드 등)
 */
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function resolveAdminUploadedImageMime(file: File): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  const t = (file.type ?? '').trim().toLowerCase()
  if (ALLOWED.has(t)) return t as 'image/jpeg' | 'image/png' | 'image/webp'

  const name = (file.name ?? '').toLowerCase()
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.webp')) return 'image/webp'

  return null
}
