import fs from 'fs'
import path from 'path'
import { isHomeHubPublicManualImageUrl } from '@/lib/home-hub-card-hybrid-core'
import { getHomeHubActiveFile, type MobileMainServiceTileKey } from '@/lib/home-hub-resolve-images'

export type MobileMainTileBgKey = MobileMainServiceTileKey

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
 * `home-hub-active.json` 의 `mobileMainServiceTiles[key]` 만 사용한다.
 * — 원격(`https://…`)은 통과, 로컬 `/images/…` 는 `public` 아래 파일이 실제로 있을 때만.
 * 유효 URL이 없으면 `null` → UI는 그라데이션만(관리자에서 Supabase 등 URL 지정 후 반영).
 */
export function resolveMobileMainTileBgSrc(key: MobileMainTileBgKey): string | null {
  const cfg = getHomeHubActiveFile()
  const raw = cfg?.mobileMainServiceTiles?.[key]?.trim()
  const fromJson = raw && isHomeHubPublicManualImageUrl(raw) ? raw : null
  if (!fromJson) return null

  if (isRemoteUrl(fromJson)) return fromJson
  if (publicFileExists(fromJson)) return fromJson
  return null
}
