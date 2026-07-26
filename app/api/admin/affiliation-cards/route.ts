import { NextResponse } from 'next/server'
import { requireAffiliationReviewer } from '@/lib/require-admin'
import { prisma } from '@/lib/prisma'
import { listAffiliationCardRequests } from '@/lib/bongsim/affiliation/affiliation-card-service'

export const dynamic = 'force-dynamic'

/** GET /api/admin/affiliation-cards?status=pending|approved|rejected|all */
export async function GET(request: Request) {
  const admin = await requireAffiliationReviewer()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '관리자·스태프만 접근할 수 있습니다.' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const statusRaw = (searchParams.get('status') || 'pending').trim()
  const status =
    statusRaw === 'approved' || statusRaw === 'rejected' || statusRaw === 'all' || statusRaw === 'pending'
      ? statusRaw
      : 'pending'

  const rows = await listAffiliationCardRequests({ status, take: 100 })
  const userIds = [...new Set(rows.map((r) => r.userId))]
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          signupMethod: true,
          socialProvider: true,
          affiliationVerified: true,
        },
      })
    : []
  const byId = new Map(users.map((u) => [u.id, u]))

  return NextResponse.json({
    ok: true,
    items: rows.map((r) => {
      const u = byId.get(r.userId)
      return {
        id: r.id,
        userId: r.userId,
        userName: u?.name ?? null,
        userEmail: u?.email ?? null,
        userPhone: u?.phone ?? null,
        userSignupMethod: u?.signupMethod ?? null,
        userSocialProvider: u?.socialProvider ?? null,
        userAffiliationVerified: Boolean(u?.affiliationVerified),
        userMissing: !u,
        status: r.status,
        imageUrl: r.imageUrl,
        ocrName: r.ocrName,
        ocrCompany: r.ocrCompany,
        ocrEmail: r.ocrEmail,
        ocrPhone: r.ocrPhone,
        ocrPosition: r.ocrPosition,
        adminNote: r.adminNote,
        reviewedBy: r.reviewedBy,
        reviewedAt: r.reviewedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      }
    }),
  })
}
