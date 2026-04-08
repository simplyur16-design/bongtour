import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { assertNoInternalMetaLeak } from '@/lib/public-response-guard'
import { insertPendingMemberReview } from '@/lib/reviews-db'
import { validateMemberReviewSubmit } from '@/lib/reviews-validate'
import { getPublicMutationOriginError } from '@/lib/public-mutation-origin'

/**
 * POST /api/reviews/submit — 로그인 회원만, pending 저장 (Supabase는 서버 service role만).
 */
export async function POST(request: Request) {
  const originErr = getPublicMutationOriginError(request)
  if (originErr) {
    return NextResponse.json(
      { ok: false, error: originErr.message, code: 'origin' },
      { status: originErr.status }
    )
  }

  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: '로그인이 필요합니다.', code: 'auth' },
      { status: 401 }
    )
  }
  const accountStatus = (session.user as { accountStatus?: string | null }).accountStatus ?? 'active'
  if (accountStatus === 'suspended' || accountStatus === 'withdrawn') {
    return NextResponse.json(
      { ok: false, error: '이용이 제한된 계정입니다.', code: 'auth' },
      { status: 403 }
    )
  }

  const alive = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, accountStatus: true },
  })
  if (!alive || alive.accountStatus !== 'active') {
    return NextResponse.json(
      { ok: false, error: '유효한 회원만 후기를 제출할 수 있습니다.', code: 'auth' },
      { status: 403 }
    )
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'JSON 본문이 필요합니다.', code: 'validation' },
      { status: 400 }
    )
  }

  const validated = validateMemberReviewSubmit(json)
  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, error: validated.error, code: validated.code ?? 'validation' },
      { status: 400 }
    )
  }

  const result = await insertPendingMemberReview(userId, validated.value)
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, code: 'server' },
      { status: 503 }
    )
  }

  const payload = {
    ok: true,
    id: result.id,
    message: '후기가 접수되었습니다. 관리자 검토 후 공개 여부가 결정됩니다.',
  }
  assertNoInternalMetaLeak(payload, 'POST /api/reviews/submit')
  return NextResponse.json(payload)
}
