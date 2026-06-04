import type { GroupMeetingReviewCardModel } from '@/lib/group-meeting-reviews-csv'
import { groupMeetingReviewDisplayText } from '@/lib/group-meeting-review-display-text'
import type { ReviewCardModel, ReviewType } from '@/lib/reviews-types'

/** 모임여행 CSV/DB 카드 → 패키지 후기와 동일한 `TravelReviewCard` / `HomeReviewGridCard` 모델 */
export function groupMeetingReviewToCardModel(review: GroupMeetingReviewCardModel): ReviewCardModel {
  const excerpt =
    review.excerpt?.trim() ||
    groupMeetingReviewDisplayText(review) ||
    review.bodyLines?.trim() ||
    ''

  return {
    id: review.id,
    title: review.title,
    excerpt,
    review_type: review.review_type as ReviewType,
    customer_type: review.customer_type,
    destination_country: review.destination_country,
    destination_city: review.destination_city,
    rating_label: review.ratingLabel,
    tags: review.displayTags ?? [],
    travel_month: null,
    displayed_date: review.dateLabel,
    thumbnail_url: review.thumbnail_url,
  }
}

export function groupMeetingReviewsToCardModels(reviews: GroupMeetingReviewCardModel[]): ReviewCardModel[] {
  return reviews
    .map(groupMeetingReviewToCardModel)
    .filter((r) => r.id && r.title && r.excerpt)
}
