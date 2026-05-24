import { unstable_cache } from 'next/cache'
import {
  pickHomeHubTravelCardCover,
  type HomeHubTravelCardCoverPick,
  type HomeHubTravelCardCoverScope,
} from '@/lib/home-hub-travel-card-cover'
import { listOverseasHomeReviewSections } from '@/lib/reviews-db'
import type { ReviewCardModel } from '@/lib/reviews-types'

/** 메인 ISR(`revalidate=300`)과 동일 — 허브 커버·후기 Supabase/Prisma 부하 완화 */
const HOME_PAGE_DATA_REVALIDATE_SEC = 300

export function getCachedHomeHubTravelCardCover(
  scope: HomeHubTravelCardCoverScope,
): Promise<HomeHubTravelCardCoverPick | null> {
  return unstable_cache(() => pickHomeHubTravelCardCover(scope), ['home-hub-cover-pick-v1', scope], {
    revalidate: HOME_PAGE_DATA_REVALIDATE_SEC,
  })()
}

export function getCachedOverseasHomeReviewSections(): Promise<{
  packageReviews: ReviewCardModel[]
  groupReviews: ReviewCardModel[]
}> {
  return unstable_cache(() => listOverseasHomeReviewSections(), ['home-overseas-review-sections-v1'], {
    revalidate: HOME_PAGE_DATA_REVALIDATE_SEC,
  })()
}
