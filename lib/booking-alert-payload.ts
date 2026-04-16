import type { BookingIntakeDto } from '@/lib/booking-intake-contract'

export type AdminBookingAlertPayload = {
  customerName: string
  customerPhone: string
  customerEmail: string
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
  opts: { productTitle?: string | null; adminLinkBase?: string }
): AdminBookingAlertPayload {
  const preferredOrSelectedDate = intake.selectedDepartureDate ?? intake.preferredDepartureDate ?? null
  const paxSummary = `총 ${intake.totalPax}명 (성인 ${intake.adultCount} / 아동 ${intake.childCount}[베드 ${intake.childWithBedCount}, 노베드 ${intake.childNoBedCount}] / 유아 ${intake.infantCount})`
  const births = intake.childInfantBirthDates.map((x) => `${x.type}:${x.birthDate}`)
  const adminBase = (opts.adminLinkBase ?? '').trim().replace(/\/$/, '')
  const adminLink = adminBase ? `${adminBase}/admin/bookings` : '/admin/bookings'
  return {
    customerName: intake.customerName,
    customerPhone: intake.customerPhone,
    customerEmail: (intake.customerEmail ?? '').trim(),
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
