import { unstable_cache } from 'next/cache'
import { shouldSkipDbAtBuild } from '@/lib/build-time-db'
import {
  pickHomeHubTravelCardCover,
  type HomeHubTravelCardCoverPick,
  type HomeHubTravelCardCoverScope,
} from '@/lib/home-hub-travel-card-cover'
import { listOverseasHomeReviewSections } from '@/lib/reviews-db'
import type { ReviewCardModel } from '@/lib/reviews-types'
import { readCachedSectionsOrBypassAllEmpty } from '@/lib/unstable-cache-empty-bypass'

/** 메인 ISR(`revalidate=300`)과 동일 — 허브 커버·후기 Supabase/Prisma 부하 완화 */
const HOME_PAGE_DATA_REVALIDATE_SEC = 300

export function getCachedHomeHubTravelCardCover(
  scope: HomeHubTravelCardCoverScope,
): Promise<HomeHubTravelCardCoverPick | null> {
  return unstable_cache(() => pickHomeHubTravelCardCover(scope), ['home-hub-cover-pick-v1', scope], {
    revalidate: HOME_PAGE_DATA_REVALIDATE_SEC,
  })()
}

/**
 * build SSG에서 후기 DB(Supabase) 조회 금지 — 60s page timeout / statement timeout 방지.
 * REGRESSION-FREEZE[build-ssg-skip-db]: home reviews skip outside cache — manifest
 * REGRESSION-FREEZE[home-ssg-empty-poison]: home reviews empty bypass — manifest
 */
export async function getCachedOverseasHomeReviewSections(): Promise<{
  packageReviews: ReviewCardModel[]
  groupReviews: ReviewCardModel[]
}> {
  if (shouldSkipDbAtBuild()) {
    return { packageReviews: [], groupReviews: [] }
  }
  const readCached = unstable_cache(
    () => listOverseasHomeReviewSections(),
    ['home-overseas-review-sections-v1'],
    { revalidate: HOME_PAGE_DATA_REVALIDATE_SEC },
  )
  // 후기 섹션 자체는 유지 — 빈 캐시 고착만 우회 (리뷰 기능/데이터 삭제 금지)
  return readCachedSectionsOrBypassAllEmpty(
    readCached,
    () => listOverseasHomeReviewSections(),
    ['packageReviews', 'groupReviews'] as const,
  )
}
