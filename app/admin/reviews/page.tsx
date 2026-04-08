import ReviewsAdminClient from '@/app/admin/reviews/ReviewsAdminClient'

export const metadata = {
  title: '회원 여행 후기 검수 | 관리',
}

export default function AdminReviewsPage() {
  return <ReviewsAdminClient />
}
