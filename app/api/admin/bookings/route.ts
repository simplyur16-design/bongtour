import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { maskEmail, maskPhone } from '@/lib/pii'
import { fetchConsultIntakesForAdmin } from '@/lib/admin-consult-intake'

/**
 * GET /api/admin/bookings — 패키지 예약 + CustomerInquiry(여행 상담) 통합 목록.
 * `bookings` 키는 기존 상세 패널용 전체 Booking 행(마스킹 적용).
 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const isSuper = admin.user.role === 'SUPER_ADMIN'
    const { bookings: intakeBookings, inquiries, items } = await fetchConsultIntakesForAdmin(isSuper)

    const bookings = await prisma.booking.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          select: { id: true, title: true, originCode: true },
        },
      },
    })
    const rows = bookings.map((b) => ({
      ...b,
      customerPhone: isSuper ? b.customerPhone : maskPhone(b.customerPhone),
      customerEmail: b.customerEmail ? (isSuper ? b.customerEmail : maskEmail(b.customerEmail)) : null,
    }))

    return NextResponse.json({
      bookings: rows,
      inquiries,
      intakeItems: items,
      intakeBookings,
      counts: {
        bookings: intakeBookings.length,
        inquiries: inquiries.length,
        total: items.length,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
