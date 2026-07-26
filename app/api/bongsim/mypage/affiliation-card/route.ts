import { auth } from '@/auth'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'
import { getRateLimitStore } from '@/lib/rate-limit-store'
import { prisma } from '@/lib/prisma'
import {
  getLatestAffiliationCardForUser,
  submitAffiliationCardRequest,
} from '@/lib/bongsim/affiliation/affiliation-card-service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const RATE_WINDOW_MS = 60_000
const RATE_MAX = 3

export async function GET() {
  const session = await auth()
  const userId = ((session?.user as { id?: string } | undefined)?.id ?? '').trim()
  if (!userId) {
    return jsonWithLeakGuard({ error: 'unauthorized' }, 'bongsim.mypage.affiliation-card.get', {
      status: 401,
    })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      pressVerified: true,
      affiliationVerified: true,
      affiliationVerifiedAt: true,
      affiliationOrgName: true,
      affiliationCardImageUrl: true,
    },
  })
  const latest = await getLatestAffiliationCardForUser(userId)

  return jsonWithLeakGuard(
    {
      ok: true,
      user: user
        ? {
            pressVerified: user.pressVerified,
            affiliationVerified: user.affiliationVerified,
            affiliationVerifiedAt: user.affiliationVerifiedAt?.toISOString() ?? null,
            affiliationOrgName: user.affiliationOrgName,
            affiliationCardImageUrl: user.affiliationCardImageUrl,
          }
        : null,
      latest: latest
        ? {
            id: latest.id,
            status: latest.status,
            imageUrl: latest.imageUrl,
            ocrName: latest.ocrName,
            ocrCompany: latest.ocrCompany,
            ocrEmail: latest.ocrEmail,
            ocrPhone: latest.ocrPhone,
            ocrPosition: latest.ocrPosition,
            createdAt: latest.createdAt.toISOString(),
            reviewedAt: latest.reviewedAt?.toISOString() ?? null,
            adminNote: latest.adminNote,
          }
        : null,
    },
    'bongsim.mypage.affiliation-card.get',
  )
}

export async function POST(req: Request) {
  const session = await auth()
  const userId = ((session?.user as { id?: string } | undefined)?.id ?? '').trim()
  if (!userId) {
    return jsonWithLeakGuard({ error: 'unauthorized' }, 'bongsim.mypage.affiliation-card.post', {
      status: 401,
    })
  }

  const store = getRateLimitStore()
  const bucket = await store.incr(`affiliation-card:${userId}`, RATE_WINDOW_MS)
  if (bucket.count > RATE_MAX) {
    return jsonWithLeakGuard(
      { error: 'rate_limited', message: '잠시 후 다시 시도해 주세요.' },
      'bongsim.mypage.affiliation-card.post',
      { status: 429 },
    )
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return jsonWithLeakGuard(
      { error: 'invalid_body', message: 'multipart 본문이 필요합니다.' },
      'bongsim.mypage.affiliation-card.post',
      { status: 400 },
    )
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return jsonWithLeakGuard(
      { error: 'invalid_image', message: '명함 이미지 파일이 필요합니다.' },
      'bongsim.mypage.affiliation-card.post',
      { status: 400 },
    )
  }

  const buf = Buffer.from(await file.arrayBuffer())
  const result = await submitAffiliationCardRequest({
    userId,
    fileBuffer: buf,
    contentType: file.type || 'image/jpeg',
    fileName: file.name,
  })

  if (!result.ok) {
    const status =
      result.reason === 'already_verified' || result.reason === 'pending_exists'
        ? 409
        : result.reason === 'invalid_image'
          ? 400
          : result.reason === 'storage_unconfigured'
            ? 503
            : 500
    return jsonWithLeakGuard(
      { error: result.reason, message: result.message },
      'bongsim.mypage.affiliation-card.post',
      { status },
    )
  }

  return jsonWithLeakGuard(
    {
      ok: true,
      requestId: result.requestId,
      status: result.status,
      ocrOk: result.ocrOk,
      fields: result.fields,
      imageUrl: result.imageUrl,
    },
    'bongsim.mypage.affiliation-card.post',
  )
}
