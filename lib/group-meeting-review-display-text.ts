import type { GroupMeetingReviewCardModel } from '@/lib/group-meeting-reviews-csv'

/** 카드 본문 — body 우선, 없으면 excerpt */
export function groupMeetingReviewDisplayText(review: GroupMeetingReviewCardModel): string {
  return review.body?.trim() || review.excerpt?.trim() || review.bodyLines?.trim() || ''
}
