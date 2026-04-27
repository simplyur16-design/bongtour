/**
 * 메인 4허브 카드 배경 — 폴백 경로.
 * 우선순위: `public/data/home-hub-active.json` → 이 모듈의 시즌 경로.
 * 운영 흐름·DB 확장: `docs/HOME-HUB-CARD-IMAGES.md`, 관리자 `/admin/home-hub-card-images`.
 */
export type HomeHubSeasonId = 'base' | 'spring' | 'summer' | 'autumn' | 'winter'

export type HomeHubCardImageKey = 'overseas' | 'training' | 'domestic' | 'esim'

/** 메인 4번째 카드(여행 eSIM) 정적 폴백 — `public/images/home-hub/esim-hero.png` */
export const HOME_HUB_ESIM_DEFAULT_IMAGE_URL = "/images/home-hub/esim-hero.png"

/** 운영 시 봄/여름/가을/겨울 폴더를 만들고 여기만 변경 */
export const HOME_HUB_ACTIVE_SEASON: HomeHubSeasonId = 'base'

export function homeHubCardImageSrc(key: HomeHubCardImageKey, ext: 'jpg' | 'webp' = 'jpg'): string {
  if (key === 'esim') return HOME_HUB_ESIM_DEFAULT_IMAGE_URL
  return `/images/home-hub/${HOME_HUB_ACTIVE_SEASON}/${key}.${ext}`
}
