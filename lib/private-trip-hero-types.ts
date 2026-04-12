/** 클라이언트·서버 공용 타입 (Node 전용 모듈에 의존하지 않음) */

export type PrivateTripHeroSlide = {
  imageUrl: string
  headline?: string
  caption?: string
  linkHref?: string
}

export type PrivateTripHeroSlidesFile = {
  lastUpdatedAt?: string | null
  lastUpdatedBy?: string | null
  slides: PrivateTripHeroSlide[]
}

export type WritePrivateTripHeroSlidesInput = {
  slides: PrivateTripHeroSlide[]
  lastUpdatedBy: string
}
