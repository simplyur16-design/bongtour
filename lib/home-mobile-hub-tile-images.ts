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
 * 같은 파일명은 같은 사진의 파생본이 아니다.
 * 이 표에 적힌 base URL만, 기록된 url이 그 원본의 반응형 후보이고 파일이 있을 때 고른다.
 * 표는 비어 있다. `base/training.webp`(협업 사진)와 `mobile/training.webp`(다른 그림)를 묶지 않는다.
 * REGRESSION-FREEZE[speed-home-responsive-images]: unproven same-name mobile sibling keeps the original — manifest
 */
export type SameOriginalMobileVariant = {
  url: string
  width: number
}

export const SAME_ORIGINAL_MOBILE_BY_BASE: Readonly<Record<string, SameOriginalMobileVariant>> = Object.freeze({})

const TRAINING_BASE_URL = '/images/home-hub/base/training.webp'
/** 기존 원본 `base/training.webp`의 가로. 다른 그림인 mobile 형제의 가로를 쓰지 않는다. */
const TRAINING_BASE_WIDTH = 1600

export function selectProvenMobileHubVariant(
  src: string,
  provenByBase: Readonly<Record<string, SameOriginalMobileVariant>>,
  fileExists: (url: string) => boolean,
): string {
  const t = src.trim()
  if (isRemoteUrl(t)) return t
  const proven = provenByBase[t]
  if (!proven?.url || proven.url === t) return t
  return fileExists(proven.url) ? proven.url : t
}

export function selectProvenTrainingSrcSet(
  src: string,
  provenByBase: Readonly<Record<string, SameOriginalMobileVariant>>,
  fileExists: (url: string) => boolean,
): string | null {
  const t = src.trim()
  const proven = provenByBase[TRAINING_BASE_URL]
  if (t !== TRAINING_BASE_URL && t !== proven?.url) return null
  if (!proven?.url || proven.url === TRAINING_BASE_URL) return null
  if (!Number.isInteger(proven.width) || proven.width < 1 || proven.width >= TRAINING_BASE_WIDTH) return null
  if (!fileExists(proven.url) || !fileExists(TRAINING_BASE_URL)) return null
  return `${proven.url} ${proven.width}w, ${TRAINING_BASE_URL} ${TRAINING_BASE_WIDTH}w`
}

/** 원격·Ncloud URL과, 동일 원본 증거가 없는 로컬 경로는 그대로 둔다. */
export function preferMobileHubLocalVariant(src: string): string {
  return selectProvenMobileHubVariant(src, SAME_ORIGINAL_MOBILE_BY_BASE, publicFileExists)
}

/** 동일 원본으로 기록된 training 후보가 없으면 srcset을 만들지 않는다. */
export function homeHubTrainingSrcSet(src: string): string | null {
  return selectProvenTrainingSrcSet(src, SAME_ORIGINAL_MOBILE_BY_BASE, publicFileExists)
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
