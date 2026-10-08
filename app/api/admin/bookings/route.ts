import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { fetchConsultIntakesForAdmin } from '@/lib/admin-consult-intake'

/**
 * GET /api/admin/bookings — 패키지 예약 + CustomerInquiry(여행 상담) 통합 목록.
 * `bookings` 키는 목록 KPI용 lean rows (상세는 개별 API).
 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const isSuper = admin.user.role === 'SUPER_ADMIN'
    // REGRESSION-FREEZE[admin-bookings-list-lean]: single intake query — no second full booking findMany — manifest
    const { bookings: intakeBookings, inquiries, items } = await fetchConsultIntakesForAdmin(isSuper)

    // 목록 KPI(상담중/예약확정)용 lean rows — 상세는 /api/admin/bookings/[id]
    const rows = intakeBookings.map((b) => ({
      id: b.id,
      bookingNumber: b.accessionNumber,
      createdAt: b.createdAt,
      customerName: b.customerName,
      status: b.status,
      selectedDate: b.selectedDate,
      product: { title: b.productTitle },
      customerPhone: null as string | null,
      customerEmail: null as string | null,
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
