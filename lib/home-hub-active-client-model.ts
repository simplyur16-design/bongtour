import type { HomeHubCardImageKey } from '@/lib/home-hub-images'

/** 클라이언트·API 응답용 활성 JSON 스냅샷 (`home-hub-resolve-images` 의존 없음) */
export type HomeHubActiveClientModel = {
  activeSeason?: string
  season?: string
  lastUpdatedAt?: string
  lastUpdatedBy?: string
  images?: Partial<Record<HomeHubCardImageKey, string>>
}
