import type { HomeHubCardImageKey } from '@/lib/home-hub-images'
import type { HomeHubActiveFile } from '@/lib/home-hub-resolve-images'

/** 클라이언트·API 응답용 활성 JSON 스냅샷 (`home-hub-resolve-images` 의존 없음) */
export type HomeHubActiveClientModel = {
  activeSeason?: string
  season?: string
  lastUpdatedAt?: string
  lastUpdatedBy?: string
  images?: Partial<Record<HomeHubCardImageKey, string>>
  /** 메인 하이브리드용 — 생략 시 서버에서 해외/국내=product_pool, 연수/버스=manual 로 해석 */
  imageSourceModes?: Partial<Record<HomeHubCardImageKey, 'manual' | 'product_pool'>>
  /** 국외연수 `/training` 통역 블록 등 두 번째 이미지 URL */
  trainingPageSecondaryImage?: string
}

export function homeHubActiveFileToClientModel(cfg: HomeHubActiveFile): HomeHubActiveClientModel {
  return {
    activeSeason: cfg.activeSeason,
    season: cfg.season,
    lastUpdatedAt: cfg.lastUpdatedAt,
    lastUpdatedBy: cfg.lastUpdatedBy,
    images: cfg.images,
    imageSourceModes: cfg.imageSourceModes,
    trainingPageSecondaryImage: cfg.trainingPageSecondaryImage,
  }
}
