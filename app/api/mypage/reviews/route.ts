import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { listMemberReviews } from '@/lib/reviews-db'
import { parseTripLineFromTags, tripLineLabel } from '@/lib/member-review-trip-line'
import { REVIEW_TYPE_LABELS } from '@/lib/review-type-labels'
import type { ReviewStatus, ReviewType } from '@/lib/reviews-types'

export type MypageReviewRow = {
  id: string
  title: string
  excerpt: string
  category: string
  review_type: string
  review_type_label: string
  trip_line_label: string
  status: ReviewStatus
  status_label: string
  rejection_reason: string | null
  can_edit: boolean
  created_at: string
  updated_at: string
}

function reviewStatusLabelForMember(status: string): string {
  switch (status) {
    case 'pending':
      return '검토 대기'
    case 'published':
      return '게시됨'
    case 'rejected':
      return '반려'
    case 'archived':
      return '보관'
    default:
      return status
  }
}

export async function GET() {
  const session = await auth()
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    return NextResponse.json({ ok: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const rows = await listMemberReviews(userId)
  const reviews: MypageReviewRow[] = rows.map((r) => {
    const rt = r.review_type as ReviewType
    const tripLine = parseTripLineFromTags(r.tags)
    return {
      id: r.id,
      title: r.title,
      excerpt: r.excerpt,
      category: r.category,
      review_type: r.review_type,
      review_type_label: REVIEW_TYPE_LABELS[rt] ?? r.review_type,
      trip_line_label: tripLineLabel(tripLine),
      status: r.status,
      status_label: reviewStatusLabelForMember(r.status),
      rejection_reason: r.rejection_reason,
      can_edit: r.status === 'pending' || r.status === 'rejected',
      created_at: r.created_at,
      updated_at: r.updated_at,
    }
  })

  return NextResponse.json({ ok: true, reviews })
}
