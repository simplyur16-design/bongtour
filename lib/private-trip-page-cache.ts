import { unstable_cache } from 'next/cache'
import { sampleReviewsForDisplay } from '@/lib/group-meeting-reviews-display'
import { loadGroupMeetingReviewsFromDb } from '@/lib/group-meeting-reviews-db'
import { loadGroupMeetingReviewsFromCsv } from '@/lib/group-meeting-reviews-csv'
import { listPrivateTripHeroStoragePublicUrls } from '@/lib/private-trip-hero-supabase'

async function loadPrivateTripReviewsForPage() {
  let groupMeetingReviews = await loadGroupMeetingReviewsFromDb()
  if (!groupMeetingReviews.length) {
    groupMeetingReviews = await loadGroupMeetingReviewsFromCsv()
  }
  return sampleReviewsForDisplay(groupMeetingReviews)
}

export const getCachedPrivateTripReviews = unstable_cache(
  loadPrivateTripReviewsForPage,
  ['private-trip-reviews-v1'],
  { revalidate: 300, tags: ['private-trip'] },
)

export const getCachedPrivateTripHeroUrls = unstable_cache(
  async () => {
    try {
      return await listPrivateTripHeroStoragePublicUrls()
    } catch {
      return [] as string[]
    }
  },
  ['private-trip-hero-urls-v1'],
  { revalidate: 300, tags: ['private-trip'] },
)
