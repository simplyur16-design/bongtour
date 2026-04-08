import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { adminListReviews } from '@/lib/reviews-db'
import type { ReviewRow } from '@/lib/reviews-types'

const STATUSES: Array<ReviewRow['status'] | 'all'> = ['pending', 'published', 'rejected', 'archived', 'all']

/** GET /api/admin/reviews?status=pending&limit=50&offset=0 */
export async function GET(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '관리자만 접근할 수 있습니다.' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const raw = (searchParams.get('status') ?? 'pending') as ReviewRow['status'] | 'all'
  const status = STATUSES.includes(raw) ? raw : 'pending'
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50))
  const offset = Math.max(0, Number(searchParams.get('offset')) || 0)

  const { rows, error } = await adminListReviews({ status, limit, offset })
  if (error) {
    return NextResponse.json({ ok: false, error }, { status: 503 })
  }

  return NextResponse.json({ ok: true, status, rows, limit, offset })
}
