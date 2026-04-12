import type { PublicPageHeroTravelScope } from '@/lib/public-page-hero-editorial-line'

/** 페이지 히어로 월별 Gemini 배치 1건 — 클라이언트/서버 공용 타입만 */
export type PageHeroMonthlyGeminiJob = {
  targetMonth1To12: number
  destinationDisplay: string
  travelScope: PublicPageHeroTravelScope
}
