/**
 * 신규 예약 발생 시 관리자 알림 (기본 구조).
 * - 이메일: 환경변수 ADMIN_EMAIL 등으로 발송 로직 확장 가능
 * - 시스템 알림: DB에 Notification 레코드 저장 후 관리자 대시보드에서 노출 가능
 */
export async function notifyNewBooking(booking: {
  id: number
  productTitle: string
  selectedDate: Date
  customerName: string
  totalKrwAmount: number
}): Promise<void> {
  // TODO: 이메일 발송 (예: Resend, SendGrid)
  // const adminEmail = process.env.ADMIN_EMAIL
  // if (adminEmail) await sendEmail(adminEmail, 'Bong투어 신규 예약', formatBookingEmail(booking))

  // TODO: 시스템 알림 저장 (예: Notification 테이블에 insert 후 대시보드에서 표시)
  // await prisma.notification.create({ data: { type: 'NEW_BOOKING', bookingId: booking.id, read: false } })

  console.log('[Bong투어] 신규 예약 접수:', {
    bookingId: booking.id,
    productTitle: booking.productTitle,
    selectedDate: booking.selectedDate,
    customerName: booking.customerName,
    totalKrwAmount: booking.totalKrwAmount,
  })
}
