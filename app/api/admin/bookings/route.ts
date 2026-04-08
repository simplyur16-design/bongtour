import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { maskEmail, maskPhone } from '@/lib/pii'

/**
 * GET /api/admin/bookings. 인증: 관리자.
 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const isSuper = admin.user.role === 'SUPER_ADMIN'
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
    return NextResponse.json(rows)
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
