import fs from 'fs'
import path from 'path'
import { isHomeHubPublicManualImageUrl } from '@/lib/home-hub-card-hybrid-core'
import { getHomeHubActiveFile, type MobileMainServiceTileKey } from '@/lib/home-hub-resolve-images'

export type MobileMainTileBgKey = MobileMainServiceTileKey

/** `public/images/home-hub/mobile/` — 모바일 주요 서비스 4카드 전용 SSOT(파일이 레포에 포함됨) */
export const MOBILE_MAIN_SERVICE_TILE_DEFAULT_PATHS: Record<MobileMainTileBgKey, string> = {
  overseas: '/images/home-hub/mobile/overseas.jpg',
  airHotel: '/images/home-hub/mobile/air-hotel.jpg',
  privateTrip: '/images/home-hub/mobile/private-trip.webp',
  training: '/images/home-hub/mobile/training.jpg',
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
 * 모바일 홈 `HomeMobileHub` 주요 서비스 카드 배경 URL.
 *
 * 1. `public/data/home-hub-active.json` 의 `mobileMainServiceTiles[key]` 가 유효하면 사용(로컬은 파일 존재 시, 원격은 그대로).
 * 2. 아니면 `MOBILE_MAIN_SERVICE_TILE_DEFAULT_PATHS`(동일 `public/images/home-hub/mobile/*`).
 *
 * org-logos 등 임시 폴백은 사용하지 않는다.
 */
export function resolveMobileMainTileBgSrc(key: MobileMainTileBgKey): string {
  const cfg = getHomeHubActiveFile()
  const raw = cfg?.mobileMainServiceTiles?.[key]?.trim()
  const fromJson =
    raw && isHomeHubPublicManualImageUrl(raw) ? raw : null
  const primary = fromJson ?? MOBILE_MAIN_SERVICE_TILE_DEFAULT_PATHS[key]

  if (isRemoteUrl(primary)) return primary
  if (publicFileExists(primary)) return primary

  return MOBILE_MAIN_SERVICE_TILE_DEFAULT_PATHS[key]
}
