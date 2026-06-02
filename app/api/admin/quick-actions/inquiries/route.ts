import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminToolApi } from '@/lib/require-admin-tool'
import { maskEmail, maskPhone } from '@/lib/pii'
import { inquiryTypeLabel } from '@/lib/admin-inquiry'

export type QuickInquiryRow = {
  id: string
  inquiryNumber: string
  createdAt: string
  inquiryType: string
  inquiryTypeLabel: string
  status: string
  applicantName: string
  applicantPhone: string
  applicantEmail: string | null
  message: string | null
  productId: string | null
  snapshotProductTitle: string | null
  snapshotOriginCode: string | null
  missingProduct: boolean
}

/**
 * GET /api/admin/quick-actions/inquiries?limit=20 — 최근 문의 (productId null 우선)
 */
export async function GET(request: Request) {
  const gate = await requireAdminToolApi()
  if (gate instanceof NextResponse) return gate

  const session = gate
  const isSuper = session.user.role === 'SUPER_ADMIN'

  const limitRaw = Number(new URL(request.url).searchParams.get('limit') ?? '20')
  const limit = Math.min(30, Math.max(5, Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 20))

  try {
    const rows = await prisma.customerInquiry.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(60, limit * 3),
      select: {
        id: true,
        inquiryNumber: true,
        createdAt: true,
        inquiryType: true,
        status: true,
        applicantName: true,
        applicantPhone: true,
        applicantEmail: true,
        message: true,
        productId: true,
        snapshotProductTitle: true,
        snapshotOriginCode: true,
      },
    })

    const sorted = [...rows].sort((a, b) => {
      const aMiss = a.productId ? 1 : 0
      const bMiss = b.productId ? 1 : 0
      if (aMiss !== bMiss) return aMiss - bMiss
      return b.createdAt.getTime() - a.createdAt.getTime()
    })

    const inquiries: QuickInquiryRow[] = sorted.slice(0, limit).map((r) => ({
      id: r.id,
      inquiryNumber: r.inquiryNumber,
      createdAt: r.createdAt.toISOString(),
      inquiryType: r.inquiryType,
      inquiryTypeLabel: inquiryTypeLabel(r.inquiryType),
      status: r.status,
      applicantName: r.applicantName,
      applicantPhone: isSuper ? r.applicantPhone : maskPhone(r.applicantPhone),
      applicantEmail:
        r.applicantEmail == null ? null : isSuper ? r.applicantEmail : maskEmail(r.applicantEmail),
      message: r.message,
      productId: r.productId,
      snapshotProductTitle: r.snapshotProductTitle,
      snapshotOriginCode: r.snapshotOriginCode,
      missingProduct: !r.productId,
    }))

    return NextResponse.json({ inquiries })
  } catch (e) {
    console.error('[GET /api/admin/quick-actions/inquiries]', e)
    return NextResponse.json({ error: '목록을 불러오지 못했습니다.' }, { status: 500 })
  }
}
