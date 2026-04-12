import fs from 'fs'
import path from 'path'
import { homeHubCardImageSrc, type HomeHubCardImageKey, type HomeHubSeasonId } from '@/lib/home-hub-images'
import {
  resolveHomeHubCardHybridImageFromSnapshot,
  type HomeHubCardImageSourceMode,
} from '@/lib/home-hub-card-hybrid-core'

export type { HomeHubCardImageSourceMode } from '@/lib/home-hub-card-hybrid-core'
export {
  effectiveHomeHubCardImageSourceMode,
  getHomeHubCardHybridResolutionDetail,
  manualImageUrlFromHybridActive,
  resolveHomeHubCardHybridImageFromSnapshot,
  type HomeHubCardHybridResolutionDetail,
  type HomeHubCardHybridResolutionTier,
  type HomeHubCardHybridActiveSlice,
} from '@/lib/home-hub-card-hybrid-core'

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
  /**
   * 카드별 이미지 소스 모드. 생략 시: 해외/국내 → `product_pool`, 국외연수/전세버스 → `manual`.
   * 메인 최종 우선순위는 `resolveHomeHubCardHybridImageSrc` 주석과 동일.
   */
  imageSourceModes?: Partial<Record<HomeHubCardImageKey, HomeHubCardImageSourceMode>>
}

const HUB_CARD_KEYS: HomeHubCardImageKey[] = ['overseas', 'training', 'domestic', 'bus']

function configPath(): string {
  return path.join(process.cwd(), ...CONFIG_REL)
}

export type ResolveHomeHubCardHybridImageSrcInput = {
  productPoolOverseasUrl?: string | null
  productPoolDomesticUrl?: string | null
  /** 단위 테스트·스토리북용: 파일 대신 주입 */
  activeFile?: HomeHubActiveFile | null
}

/**
 * 메인 4허브 카드 이미지 — 하이브리드 SSOT.
 *
 * 우선순위(고정):
 * 1. `home-hub-active.json` 의 `images[key]` 가 유효 공개 URL이면 수동으로 사용
 * 2. 모드가 `product_pool`(해외/국내 기본)이고 해당 카드용 상품 풀 URL이 있으면 사용
 * 3. `homeHubCardImageSrc(key)` 정적 폴백
 *
 * 자동 슬라이드·풀 순회는 포함하지 않음(추후 동일 입력으로 확장 가능).
 */
export function resolveHomeHubCardHybridImageSrc(
  key: HomeHubCardImageKey,
  input: ResolveHomeHubCardHybridImageSrcInput = {},
): string {
  const cfg = input.activeFile !== undefined ? input.activeFile : getHomeHubActiveFile()
  return resolveHomeHubCardHybridImageFromSnapshot(key, {
    activeSnapshot: cfg,
    productPoolOverseasUrl: input.productPoolOverseasUrl,
    productPoolDomesticUrl: input.productPoolDomesticUrl,
  })
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
  imageSourceModes?: Partial<Record<HomeHubCardImageKey, HomeHubCardImageSourceMode>>
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
    imageSourceModes: { ...base.imageSourceModes, ...patch.imageSourceModes },
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
