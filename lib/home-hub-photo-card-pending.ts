import fs from 'fs'
import path from 'path'

/**
 * 로컬 `/images/...` 가 `public` 아래 실제 파일인지.
 * 원격 URL은 빌드 시 존재 여부를 알 수 없으므로, **형식이 유효하면** pending 아님으로 둔다.
 */
export function isLocalPublicHubImageMissing(src: string): boolean {
  const t = src.trim()
  if (!t.startsWith('/') || t.startsWith('//')) return false
  const rel = t.replace(/^\/+/, '')
  if (!rel || rel.includes('..')) return true
  const abs = path.join(process.cwd(), 'public', rel)
  try {
    return !fs.existsSync(abs) || !fs.statSync(abs).isFile()
  } catch {
    return true
  }
}

function isInvalidHttpUrl(s: string): boolean {
  const t = s.trim()
  if (!/^https?:\/\//i.test(t)) return false
  try {
    const u = new URL(t)
    return u.protocol !== 'http:' && u.protocol !== 'https:'
  } catch {
    return true
  }
}

/** 사진 카드 placeholder 표시 — URL 없음, 잘못된 http(s), 또는 로컬 파일 누락 */
export function hubPhotoCardIsPending(src: string | null | undefined): boolean {
  if (src == null || !String(src).trim()) return true
  const s = String(src).trim()
  if (/^https?:\/\//i.test(s)) return isInvalidHttpUrl(s)
  return isLocalPublicHubImageMissing(s)
}
