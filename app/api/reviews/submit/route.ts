import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'
import { insertPendingMemberReview } from '@/lib/reviews-db'
import { validateMemberReviewSubmit } from '@/lib/reviews-validate'
import { getRateLimitStore } from '@/lib/rate-limit-store'
import { getPublicMutationOriginError } from '@/lib/public-mutation-origin'

const REVIEW_SUBMIT_RATE_LIMIT_WINDOW_MS = 60_000
const REVIEW_SUBMIT_RATE_LIMIT_MAX = 20

function getClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() || 'unknown'
  return headers.get('x-real-ip') || 'unknown'
}

/**
 * POST /api/reviews/submit — 로그인 회원만, pending 저장 (Supabase는 서버 service role만).
 */
export async function POST(request: Request) {
  const originErr = getPublicMutationOriginError(request)
  if (originErr) {
    return jsonWithLeakGuard(
      { ok: false, error: originErr.message, code: 'origin' },
      'api.reviews.submit.origin',
      { status: originErr.status },
    )
  }

  const ip = getClientIp(request.headers)
  const store = getRateLimitStore()
  const bucket = await store.incr(`public:reviews-submit:${ip}`, REVIEW_SUBMIT_RATE_LIMIT_WINDOW_MS)
  if (bucket.count > REVIEW_SUBMIT_RATE_LIMIT_MAX) {
    return jsonWithLeakGuard(
      {
        ok: false,
        error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
        code: 'rate_limit',
      },
      'api.reviews.submit.rate-limit',
      { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000))) } },
    )
  }

  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return jsonWithLeakGuard({ ok: false, error: '로그인이 필요합니다.', code: 'auth' }, 'api.reviews.submit.auth', {
      status: 401,
    })
  }
  const accountStatus = (session.user as { accountStatus?: string | null }).accountStatus ?? 'active'
  if (accountStatus === 'suspended' || accountStatus === 'withdrawn') {
    return jsonWithLeakGuard(
      { ok: false, error: '이용이 제한된 계정입니다.', code: 'auth' },
      'api.reviews.submit.suspended',
      { status: 403 },
    )
  }

  const alive = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, accountStatus: true },
  })
  if (!alive || alive.accountStatus !== 'active') {
    return jsonWithLeakGuard(
      { ok: false, error: '유효한 회원만 후기를 제출할 수 있습니다.', code: 'auth' },
      'api.reviews.submit.not-active',
      { status: 403 },
    )
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return jsonWithLeakGuard(
      { ok: false, error: 'JSON 본문이 필요합니다.', code: 'validation' },
      'api.reviews.submit.bad-json',
      { status: 400 },
    )
  }

  const validated = validateMemberReviewSubmit(json)
  if (!validated.ok) {
    return jsonWithLeakGuard(
      { ok: false, error: validated.error, code: validated.code ?? 'validation' },
      'api.reviews.submit.validation',
      { status: 400 },
    )
  }

  const result = await insertPendingMemberReview(userId, validated.value)
  if (!result.ok) {
    return jsonWithLeakGuard(
      { ok: false, error: result.error, code: 'server' },
      'api.reviews.submit.db',
      { status: 503 },
    )
  }

  const payload = {
    ok: true,
    id: result.id,
    message: '후기가 접수되었습니다. 관리자 검토 후 공개 여부가 결정됩니다.',
  }
  return jsonWithLeakGuard(payload, 'api.reviews.submit.ok')
}
