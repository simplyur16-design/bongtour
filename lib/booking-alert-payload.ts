import { truncateForAdminInquiryLms } from '@/lib/admin-inquiry-lms-content'
import type { BookingIntakeDto } from '@/lib/booking-intake-contract'

export type AdminBookingAlertPayload = {
  customerName: string
  customerPhone: string
  customerEmail: string
  bookingNumber?: string
  productTitle?: string | null
  originSource: string
  /** 접수 시 선택한 출발 행 id(있으면) */
  departureRowId?: string | null
  preferredOrSelectedDate: string | null
  paxSummary: string
  singleRoomRequested: boolean
  preferredContactChannel: 'phone' | 'kakao' | 'email'
  childInfantBirthDates: string[]
  requestNotes: string | null
  adminLink: string
}

export function buildAdminBookingAlertPayload(
  intake: BookingIntakeDto,
  opts: { productTitle?: string | null; adminLinkBase?: string; bookingNumber?: string }
): AdminBookingAlertPayload {
  const preferredOrSelectedDate = intake.selectedDepartureDate
  const paxSummary = `총 ${intake.totalPax}명 (성인 ${intake.adultCount} / 아동 ${intake.childCount}[베드 ${intake.childWithBedCount}, 노베드 ${intake.childNoBedCount}] / 유아 ${intake.infantCount})`
  const births = intake.childInfantBirthDates.map((x) => `${x.type}:${x.birthDate}`)
  const adminBase = (opts.adminLinkBase ?? '').trim().replace(/\/$/, '')
  const adminLink = adminBase ? `${adminBase}/admin/bookings` : '/admin/bookings'
  return {
    customerName: intake.customerName,
    customerPhone: intake.customerPhone,
    customerEmail: (intake.customerEmail ?? '').trim(),
    ...(opts.bookingNumber ? { bookingNumber: opts.bookingNumber } : {}),
    productTitle: opts.productTitle ?? null,
    originSource: intake.originSource,
    departureRowId: intake.departureId ?? null,
    preferredOrSelectedDate,
    paxSummary,
    singleRoomRequested: intake.singleRoomRequested,
    preferredContactChannel: intake.preferredContactChannel,
    childInfantBirthDates: births,
    requestNotes: intake.requestNotes ?? null,
    adminLink,
  }
}

/** 예약 접수 관리자 문자 — 문의 접수와 동일하게 짧은 한 줄(Solapi). 상세는 이메일. */
export function buildAdminBookingShortAlertLine(p: AdminBookingAlertPayload): string {
  const title = truncateForAdminInquiryLms((p.productTitle ?? '상품').trim(), 24)
  const name = truncateForAdminInquiryLms(p.customerName.trim() || '고객', 16)
  const acc = (p.bookingNumber ?? '').trim()
  return acc
    ? `[봉투어] ${title} 예약 접수 ${acc} (${name})`
    : `[봉투어] ${title} 예약 접수 (${name})`
}
