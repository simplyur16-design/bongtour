import fs from 'fs'
import path from 'path'
import { isHomeHubPublicManualImageUrl } from '@/lib/home-hub-card-hybrid-core'
import { getHomeHubActiveFile, type MobileMainServiceTileKey } from '@/lib/home-hub-resolve-images'

export type MobileMainTileBgKey = MobileMainServiceTileKey

/** JSON 비어 있거나 무효일 때 — `public/images/home-hub/mobile/` 기본 배너 */
const MOBILE_HUB_DEFAULT_TILE_BG: Record<MobileMainServiceTileKey, string> = {
  overseas: '/images/home-hub/mobile/overseas.webp',
  airHotel: '/images/home-hub/mobile/air-hotel.webp',
  privateTrip: '/images/home-hub/mobile/private-trip.webp',
  training: '/images/home-hub/mobile/training.webp',
}

function isRemoteUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim())
}

function publicFileExists(urlPath: string): boolean {
  const t = urlPath.trim()
  if (!t.startsWith('/')) return false
  const rel = t.replace(/^\/+/, '')
  if (!rel || rel.includes('..')) return false
  const abs = path.join(process.cwd(), 'public', rel)
  try {
    return fs.existsSync(abs) && fs.statSync(abs).isFile()
  } catch {
    return false
  }
}

/**
 * 모바일 허브 타일 전용. 번들이 `/images/home-hub/base/*`(데스크톱 원본)를 주면
 * 같은 파일명의 `mobile/` 형제가 있을 때만 그 경로로 바꾼다. 원격·Ncloud URL은 그대로.
 * REGRESSION-FREEZE[speed-home-responsive-images]: base training → mobile sibling — manifest
 */
export function preferMobileHubLocalVariant(src: string): string {
  const t = src.trim()
  const m = /^\/images\/home-hub\/base\/([^/?#]+)$/.exec(t)
  if (!m) return t
  const mobile = `/images/home-hub/mobile/${m[1]}`
  return publicFileExists(mobile) ? mobile : t
}

/**
 * 로컬 허브 원본 + 모바일 형제가 둘 다 있을 때 native `srcset`.
 * 폭 디스크립터는 저장 파일 실측(training 1181 / base 1600). 다른 키는 폭을 추정하지 않는다.
 * REGRESSION-FREEZE[speed-home-responsive-images]: training srcset only — manifest
 */
export function homeHubTrainingSrcSet(src: string): string | null {
  const t = src.trim()
  if (t !== '/images/home-hub/base/training.webp' && t !== '/images/home-hub/mobile/training.webp') return null
  const mobile = '/images/home-hub/mobile/training.webp'
  const base = '/images/home-hub/base/training.webp'
  if (!publicFileExists(mobile) || !publicFileExists(base)) return null
  return `${mobile} 1181w, ${base} 1600w`
}

/**
 * 모바일 홈 `HomeMobileHub` 주요 서비스 카드 배경 URL.
 *
 * `home-hub-active.json` 의 `mobileMainServiceTiles[key]` 를 우선한다.
 * — 원격(`https://…`)은 통과, 로컬 `/images/…` 는 `public` 아래 파일이 실제로 있을 때만.
 * 비어 있거나 경로가 깨지면 `public/images/home-hub/mobile/*.webp` 기본 타일로 폴백.
 */
export function resolveMobileMainTileBgSrc(key: MobileMainTileBgKey): string | null {
  const cfg = getHomeHubActiveFile()
  const raw = cfg?.mobileMainServiceTiles?.[key]?.trim()
  const fromJson = raw && isHomeHubPublicManualImageUrl(raw) ? raw : null
  if (fromJson) {
    if (isRemoteUrl(fromJson)) return fromJson
    if (publicFileExists(fromJson)) return fromJson
  }
  const fallback = MOBILE_HUB_DEFAULT_TILE_BG[key]
  if (fallback && publicFileExists(fallback)) return fallback
  return null
}
