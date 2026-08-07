import { revalidatePath, revalidateTag } from 'next/cache'
import { getBongtourCronSecret, isAuthorizedCronRequest } from '@/lib/cron-auth'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'
import {
  SEASON_CURATION_CURRENT_CYCLE_CACHE_TAG,
  SEASON_CURATION_HERO_CACHE_TAG,
  SEASON_CURATION_NEXT_THREE_MONTHS_CACHE_TAG,
} from '@/lib/season-curation-content'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/season-cache-revalidate
 * 홈 시즌 히어로·다가오는 3개월·페르소나 사이클 캐시 태그 무효화.
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
    'season-linked-product-ids-v1',
  ]
  for (const tag of tags) {
    revalidateTag(tag)
  }
  revalidatePath('/')
  revalidatePath('/m')

  return jsonWithLeakGuard(
    { ok: true, tags, paths: ['/', '/m'] },
    'cron-season-cache-revalidate.response',
  )
}
