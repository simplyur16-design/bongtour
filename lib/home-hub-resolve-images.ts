import fs from 'fs'
import path from 'path'
import { homeHubCardImageSrc, type HomeHubCardImageKey, type HomeHubSeasonId } from '@/lib/home-hub-images'

const CONFIG_REL = ['public', 'data', 'home-hub-active.json'] as const

export type HomeHubActiveSeasonUi = 'default' | 'spring' | 'summer' | 'autumn' | 'winter'

export type HomeHubActiveFile = {
  /**
   * 메인·관리자 요약에서 쓰는 **운영 시즌** (UI 설계 기준).
   * 레거시: 최상위 `season` 만 있는 JSON은 그 값을 폴백으로 읽는다.
   */
  activeSeason?: HomeHubActiveSeasonUi | string
  /** @deprecated `activeSeason` 우선. 과거 폴더 메모용 `base` 등이 들어 있을 수 있음 */
  season?: HomeHubSeasonId | string
  /** ISO 8601 — 활성 JSON 마지막 갱신 (관리자 활성 저장 시 갱신 권장) */
  lastUpdatedAt?: string
  lastUpdatedBy?: string
  /** 카드별 공개 URL — `/images/...` 또는 `https://...` */
  images: Partial<Record<HomeHubCardImageKey, string>>
}

const HUB_CARD_KEYS: HomeHubCardImageKey[] = ['overseas', 'training', 'domestic', 'bus']

function configPath(): string {
  return path.join(process.cwd(), ...CONFIG_REL)
}

/**
 * 메인에 노출할 활성 이미지 URL.
 * `public/data/home-hub-active.json` 이 있으면 그 값을 우선하고, 없거나 키 누락 시 파일 경로 폴백.
 * 관리자에서 생성·업로드 후 이 JSON만 수정해도 메인 반영(재배포 없이 파일만 갱신 시 ISR/재시작 정책에 따름).
 */
export function resolveHomeHubImageSrc(key: HomeHubCardImageKey): string {
  try {
    const raw = fs.readFileSync(configPath(), 'utf8')
    const cfg = JSON.parse(raw) as HomeHubActiveFile
    const url = cfg.images?.[key]?.trim()
    if (url && (url.startsWith('/') || url.startsWith('https://'))) return url
  } catch {
    /* 파일 없음·파싱 실패 → 폴백 */
  }
  return homeHubCardImageSrc(key)
}

export function getHomeHubActiveFile(): HomeHubActiveFile | null {
  try {
    const raw = fs.readFileSync(configPath(), 'utf8')
    return JSON.parse(raw) as HomeHubActiveFile
  } catch {
    return null
  }
}

/** 메인 허브 요약·관리자 A바용. 파일 없으면 `default`. */
export function getResolvedActiveSeason(): string {
  const cfg = getHomeHubActiveFile()
  const a = cfg?.activeSeason?.trim()
  if (a) return a
  const legacy = cfg?.season?.trim()
  if (legacy) return legacy === 'base' ? 'default' : legacy
  return 'default'
}

/** `images`에 URL이 있는 카드 수 (최대 4) */
export function countActiveHubImages(cfg: HomeHubActiveFile | null): number {
  if (!cfg?.images) return 0
  return HUB_CARD_KEYS.filter((k) => {
    const u = cfg.images![k]?.trim()
    return u && (u.startsWith('/') || u.startsWith('https://'))
  }).length
}

export type WriteHomeHubActiveMergedInput = {
  images?: Partial<Record<HomeHubCardImageKey, string>>
  activeSeason?: string
  lastUpdatedBy?: string
}

/**
 * 기존 `home-hub-active.json`을 읽어 병합 후 저장. 없으면 기본 골격 생성.
 */
export function writeHomeHubActiveMerged(patch: WriteHomeHubActiveMergedInput): HomeHubActiveFile {
  const cur = getHomeHubActiveFile()
  const base: HomeHubActiveFile = cur ?? {
    activeSeason: 'default',
    images: {},
  }
  const next: HomeHubActiveFile = {
    ...base,
    ...patch,
    images: { ...base.images, ...patch.images },
    lastUpdatedAt: new Date().toISOString(),
  }
  if (patch.lastUpdatedBy !== undefined) {
    next.lastUpdatedBy = patch.lastUpdatedBy
  }
  const dir = path.dirname(configPath())
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(configPath(), JSON.stringify(next, null, 2), 'utf8')
  return next
}
