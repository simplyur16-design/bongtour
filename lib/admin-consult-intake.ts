import { prisma } from '@/lib/prisma'
import { maskEmail, maskPhone } from '@/lib/pii'
import { inquiryTypeLabel, inquiryStatusLabel } from '@/lib/admin-inquiry'

/** `/admin/bookings` 통합 목록 — 패키지 예약 */
export type ConsultIntakeBooking = {
  kind: 'booking'
  id: number
  accessionNumber: string
  createdAt: string
  productTitle: string
  customerName: string
  status: string
  selectedDate: string
}

/** `/admin/bookings` 통합 목록 — 홈·상품 문의(CustomerInquiry) */
export type ConsultIntakeInquiry = {
  kind: 'inquiry'
  id: string
  accessionNumber: string
  createdAt: string
  productTitle: string
  customerName: string
  status: string
  statusLabel: string
  inquiryType: string
  inquiryTypeLabel: string
  productId: string | null
  applicantPhone: string
  message: string | null
}

export type ConsultIntakeItem = ConsultIntakeBooking | ConsultIntakeInquiry

export async function fetchConsultIntakesForAdmin(isSuper: boolean): Promise<{
  bookings: ConsultIntakeBooking[]
  inquiries: ConsultIntakeInquiry[]
  items: ConsultIntakeItem[]
}> {
  const [bookingsRaw, inquiriesRaw] = await Promise.all([
    prisma.booking.findMany({
      orderBy: { createdAt: 'desc' },
      include: { product: { select: { title: true } } },
    }),
    prisma.customerInquiry.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        inquiryNumber: true,
        createdAt: true,
        inquiryType: true,
        status: true,
        applicantName: true,
        applicantPhone: true,
        message: true,
        snapshotProductTitle: true,
        snapshotCardLabel: true,
        productId: true,
      },
    }),
  ])

  const bookings: ConsultIntakeBooking[] = bookingsRaw.map((b) => ({
    kind: 'booking' as const,
    id: b.id,
    accessionNumber: b.bookingNumber,
    createdAt: b.createdAt.toISOString(),
    productTitle: b.productTitle,
    customerName: b.customerName,
    status: b.status,
    selectedDate: b.selectedDate.toISOString(),
  }))

  const inquiries: ConsultIntakeInquiry[] = inquiriesRaw.map((r) => ({
    kind: 'inquiry' as const,
    id: r.id,
    accessionNumber: r.inquiryNumber,
    createdAt: r.createdAt.toISOString(),
    productTitle: r.snapshotProductTitle?.trim() || r.snapshotCardLabel?.trim() || '여행 상담',
    customerName: r.applicantName,
    status: r.status,
    statusLabel: inquiryStatusLabel(r.status),
    inquiryType: r.inquiryType,
    inquiryTypeLabel: inquiryTypeLabel(r.inquiryType),
    productId: r.productId,
    applicantPhone: isSuper ? r.applicantPhone : maskPhone(r.applicantPhone),
    message: r.message,
  }))

  const items: ConsultIntakeItem[] = [...bookings, ...inquiries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  return { bookings, inquiries, items }
}

export function consultIntakeCounts(bookings: ConsultIntakeBooking[], inquiries: ConsultIntakeInquiry[]) {
  return {
    total: bookings.length + inquiries.length,
    bookings: bookings.length,
    inquiries: inquiries.length,
    bookingConsulting: bookings.filter((b) => b.status === '상담중').length,
  }
}
