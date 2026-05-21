import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { inquiryStatusLabel, inquiryTypeLabel } from '@/lib/admin-inquiry'
import { prisma } from '@/lib/prisma'

export type MypageInquiryRow = {
  id: string
  inquiryNumber: string
  createdAt: string
  inquiryType: string
  inquiryTypeLabel: string
  status: string
  statusLabel: string
  snapshotProductTitle: string | null
  snapshotCardLabel: string | null
  message: string | null
}

/**
 * GET /api/mypage/inquiries — 로그인 사용자 본인 문의 목록
 */
export async function GET() {
  const session = await auth()
  const userId = (session?.user as { id?: string } | undefined)?.id
  const email = session?.user?.email?.trim().toLowerCase()

  if (!userId && !email) {
    return NextResponse.json({ ok: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const or: { userId?: string; applicantEmail?: { equals: string; mode: 'insensitive' } }[] = []
  if (userId) or.push({ userId })
  if (email) or.push({ applicantEmail: { equals: email, mode: 'insensitive' } })

  try {
    const rows = await prisma.customerInquiry.findMany({
      where: { OR: or },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        inquiryNumber: true,
        createdAt: true,
        inquiryType: true,
        status: true,
        snapshotProductTitle: true,
        snapshotCardLabel: true,
        message: true,
      },
    })

    const inquiries: MypageInquiryRow[] = rows.map((r) => ({
      id: r.id,
      inquiryNumber: r.inquiryNumber,
      createdAt: r.createdAt.toISOString(),
      inquiryType: r.inquiryType,
      inquiryTypeLabel: inquiryTypeLabel(r.inquiryType),
      status: r.status,
      statusLabel: inquiryStatusLabel(r.status),
      snapshotProductTitle: r.snapshotProductTitle,
      snapshotCardLabel: r.snapshotCardLabel,
      message: r.message,
    }))

    return NextResponse.json({ ok: true, inquiries })
  } catch (e) {
    console.error('[mypage/inquiries]', e)
    return NextResponse.json({ ok: false, error: '목록을 불러오지 못했습니다.' }, { status: 500 })
  }
}
