/**
 * REGRESSION-FREEZE[r03-25-26-source-1128]: 사장님 2026-11-28 20:13 "난 봉투어에 위키피아 사진 넣지 않는다",
 * 20:16 "Unsplash 자동 채움에서 빼" (R03-25·R03-26).
 * 자동 채움·교체·풀 재사용·풀 보충의 새 저장 후보는 Unsplash·Wikimedia/Wikipedia·표기 필요 라이선스(CC BY 등)를 쓰지 않는다.
 * 이미 저장된 칸을 바꾸거나 지우는 동작은 여기 없다 — manifest
 */
import { isAttributionRequiredLicense } from '@/lib/product-image-source-policy'

export type BlockedAutoFillReason = 'unsplash' | 'wikimedia' | 'cc_by'

const WIKI_RE = /wikimedia|wikipedia|upload\.wikimedia\.org|commons\.wikimedia/i
const UNSPLASH_RE = /(^|\/\/|\.)unsplash\.com|images\.unsplash/i

export function isWikimediaOrWikipediaOrigin(...parts: Array<string | null | undefined>): boolean {
  return WIKI_RE.test(parts.map((p) => String(p ?? '')).join(' '))
}

export function isUnsplashOrigin(...parts: Array<string | null | undefined>): boolean {
  const t = parts.map((p) => String(p ?? '')).join(' ')
  return UNSPLASH_RE.test(t) || /(?:^|\s)unsplash(?:\s|$)/i.test(t)
}

export function isBlockedAutoFillOrigin(input: {
  source?: string | null
  url?: string | null
  originalLink?: string | null
  pageUrl?: string | null
  license?: string | null
  description?: string | null
  poolOriginSource?: string | null
}): { blocked: true; reason: BlockedAutoFillReason } | { blocked: false; reason: null } {
  const source = `${input.source ?? ''} ${input.poolOriginSource ?? ''}`
  const urls = `${input.url ?? ''} ${input.originalLink ?? ''} ${input.pageUrl ?? ''}`
  const license = `${input.license ?? ''} ${input.description ?? ''}`
  if (isUnsplashOrigin(source, urls)) return { blocked: true, reason: 'unsplash' }
  if (isWikimediaOrWikipediaOrigin(source, urls)) return { blocked: true, reason: 'wikimedia' }
  if (isAttributionRequiredLicense(license) || isAttributionRequiredLicense(source)) {
    return { blocked: true, reason: 'cc_by' }
  }
  return { blocked: false, reason: null }
}
