import { BONGSIM_FLAG_NCLOUD_BY_ISO } from '@/lib/bongsim-flag-ncloud-manifest'

const ISO_ALPHA2_RE = /^[a-z]{2}$/

/** 레거시 flagcdn (마이그레이션 전·manifest 미등록 코드) */
export function flagcdnImageUrl(isoAlpha2: string): string {
  return `https://flagcdn.com/w160/${isoAlpha2.toLowerCase()}.png`
}

/** Bongsim 국기 이미지 — manifest(NCloud) 우선, 없으면 flagcdn */
export function resolveBongsimFlagImageUrl(isoAlpha2: string): string | null {
  const code = isoAlpha2.trim().toLowerCase()
  if (!ISO_ALPHA2_RE.test(code)) return null
  const fromManifest = BONGSIM_FLAG_NCLOUD_BY_ISO[code]
  if (fromManifest?.trim()) return fromManifest.trim()
  return flagcdnImageUrl(code)
}

/** UI용 — 항상 URL 문자열 (manifest → flagcdn) */
export function resolveBongsimFlagImageUrlOrFallback(isoAlpha2: string): string {
  return resolveBongsimFlagImageUrl(isoAlpha2) ?? flagcdnImageUrl(isoAlpha2.trim().toLowerCase())
}
