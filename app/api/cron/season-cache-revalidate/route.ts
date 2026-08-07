import { revalidatePath, revalidateTag } from 'next/cache'
import { getBongtourCronSecret, isAuthorizedCronRequest } from '@/lib/cron-auth'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'
import { OVERSEAS_HUB_SEASON_DESTINATION_HERO_CACHE_TAG } from '@/lib/overseas-hub-season-destination-hero'
import {
  SEASON_CURATION_CURRENT_CYCLE_CACHE_TAG,
  SEASON_CURATION_HERO_CACHE_TAG,
  SEASON_CURATION_NEXT_THREE_MONTHS_CACHE_TAG,
} from '@/lib/season-curation-content'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/season-cache-revalidate
 * 홈 시즌·페르소나·해외 허브 3개월 추천 캐시 태그 무효화.
 * Header: x-bongtour-cron-secret
 */
export async function POST(req: Request) {
  if (!getBongtourCronSecret()) {
    return jsonWithLeakGuard(
      { error: 'cron_secret_unconfigured' },
      'cron-season-cache-revalidate',
      { status: 401 },
    )
  }
  if (!isAuthorizedCronRequest(req)) {
    return jsonWithLeakGuard({ error: 'unauthorized' }, 'cron-season-cache-revalidate', {
      status: 401,
    })
  }

  const tags = [
    SEASON_CURATION_HERO_CACHE_TAG,
    SEASON_CURATION_NEXT_THREE_MONTHS_CACHE_TAG,
    SEASON_CURATION_CURRENT_CYCLE_CACHE_TAG,
    OVERSEAS_HUB_SEASON_DESTINATION_HERO_CACHE_TAG,
    'persona-curated-destinations-v10',
    'season-linked-product-ids-v2',
  ]
  for (const tag of tags) {
    revalidateTag(tag)
  }
  const paths = ['/', '/m', '/travel/overseas']
  for (const path of paths) {
    revalidatePath(path)
  }

  return jsonWithLeakGuard(
    { ok: true, tags, paths },
    'cron-season-cache-revalidate.response',
  )
}
