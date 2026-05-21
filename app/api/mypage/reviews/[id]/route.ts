import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getMemberReviewById, updateMemberReview } from '@/lib/reviews-db'
import { validateMemberReviewSubmit } from '@/lib/reviews-validate'
import { parseTripLineFromTags } from '@/lib/member-review-trip-line'
import type { ReviewRow } from '@/lib/reviews-types'

function toEditPayload(row: ReviewRow) {
  return {
    id: row.id,
    category: row.category,
    review_type: row.review_type,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    customer_type: row.customer_type,
    destination_country: row.destination_country,
    destination_city: row.destination_city,
    tags: row.tags,
    travel_month: row.travel_month ? String(row.travel_month).slice(0, 7) : '',
    rating_label: row.rating_label,
    thumbnail_url: row.thumbnail_url,
    trip_line: parseTripLineFromTags(row.tags),
    status: row.status,
    rejection_reason: row.rejection_reason,
    can_edit: row.status === 'pending' || row.status === 'rejected',
  }
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    return NextResponse.json({ ok: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }
  const { id } = await context.params
  const row = await getMemberReviewById(userId, id)
  if (!row) {
    return NextResponse.json({ ok: false, error: '후기를 찾을 수 없습니다.' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, review: toEditPayload(row) })
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    return NextResponse.json({ ok: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }
  const { id } = await context.params

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON 본문이 필요합니다.' }, { status: 400 })
  }

  const validated = validateMemberReviewSubmit(json)
  if (!validated.ok) {
    return NextResponse.json({ ok: false, error: validated.error }, { status: 400 })
  }

  const result = await updateMemberReview(userId, id, validated.value)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    message: '수정이 접수되었습니다. 다시 검토 후 공개 여부가 결정됩니다.',
  })
}
