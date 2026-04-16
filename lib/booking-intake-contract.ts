/**
 * POST /api/bookings 입력 계약 (고객 UI 없이 서버 기준 고정).
 * 정책 상세: docs/BOOKING-INTAKE-POLICY.md
 */

import { digitsOnlyTel } from '@/lib/korean-tel-format'
import { optionalEmailFormatError } from '@/lib/email-format'

export type PassengerBirth = {
  type: 'child' | 'infant'
  birthDate: string // YYYY-MM-DD
}

export type BookingIntakeDto = {
  productId: string
  originSource: string
  originCode: string
  /** 상품 캘린더에서 고른 확정 일정(있으면 견적 산정에 사용). 없으면 null */
  selectedDepartureDate?: string | null
  /** 희망 출발일(텍스트/날짜). 선택 일정이 없을 때만 필수로 쓰일 수 있음 */
  preferredDepartureDate?: string | null
  /** 선택적: ProductDeparture.id 등 (향후 연계) */
  departureId?: string | null
  customerName: string
  customerPhone: string
  customerEmail: string
  /** 서버에서 adult+child+infant 로 계산해 고정 */
  totalPax: number
  adultCount: number
  childCount: number
  childWithBedCount: number
  childNoBedCount: number
  infantCount: number
  singleRoomRequested: boolean
  preferredContactChannel: 'phone' | 'kakao' | 'email'
  childInfantBirthDates: PassengerBirth[]
  requestNotes?: string | null
}

export type BookingValidationResult =
  | { ok: true; value: BookingIntakeDto }
  | { ok: false; errors: string[] }

function isYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

export function validateBookingIntake(input: unknown): BookingValidationResult {
  const b = (input ?? {}) as Record<string, unknown>
  const errors: string[] = []
  const customerName = String(b.customerName ?? '').trim()
  const customerPhone = String(b.customerPhone ?? '').trim()
  const customerEmail = String(b.customerEmail ?? '').trim()
  const productId = String(b.productId ?? '').trim()
  const originSource = String(b.originSource ?? '').trim()
  const originCode = String(b.originCode ?? '').trim()
  const selectedDepartureDate = b.selectedDepartureDate == null ? null : String(b.selectedDepartureDate).trim() || null
  const preferredDepartureDate =
    b.preferredDepartureDate == null ? null : String(b.preferredDepartureDate).trim() || null
  const departureId = b.departureId == null ? null : String(b.departureId).trim() || null

  const adultCount = Number(b.adultCount ?? 0) || 0
  const childCount = Number(b.childCount ?? 0) || 0
  const childWithBedCount = Number(b.childWithBedCount ?? b.childBedCount ?? 0) || 0
  const childNoBedCount = Number(b.childNoBedCount ?? 0) || 0
  const infantCount = Number(b.infantCount ?? 0) || 0
  const singleRoomRequested = Boolean(b.singleRoomRequested)
  const preferredContactChannelRaw = String(b.preferredContactChannel ?? 'phone').trim().toLowerCase()
  const preferredContactChannel: BookingIntakeDto['preferredContactChannel'] =
    preferredContactChannelRaw === 'kakao' || preferredContactChannelRaw === 'email'
      ? preferredContactChannelRaw
      : 'phone'

  const computedTotalPax = adultCount + childCount + infantCount
  const clientTotalRaw = b.totalPax
  if (clientTotalRaw !== undefined && clientTotalRaw !== null && String(clientTotalRaw).trim() !== '') {
    const clientTotal = Number(clientTotalRaw) || 0
    if (clientTotal !== computedTotalPax) {
      errors.push('totalPax는 성인·아동·유아 합계와 일치해야 합니다.')
    }
  }

  const requestNotes = b.requestNotes == null ? null : String(b.requestNotes).trim() || null
  const rawBirths = Array.isArray(b.childInfantBirthDates) ? b.childInfantBirthDates : []
  const childInfantBirthDates: PassengerBirth[] = rawBirths
    .map((x) => {
      const rec = x as Record<string, unknown>
      const type: PassengerBirth['type'] = rec.type === 'infant' ? 'infant' : 'child'
      return {
        type,
        birthDate: String(rec.birthDate ?? '').trim(),
      }
    })
    .filter((x) => x.birthDate.length > 0)

  if (!customerName) errors.push('고객 이름을 입력해 주세요.')
  if (!customerPhone) errors.push('휴대폰 번호를 입력해 주세요.')
  else {
    const phoneDigits = digitsOnlyTel(customerPhone)
    if (phoneDigits.length < 8) errors.push('연락처를 확인해 주세요. (숫자 8자리 이상)')
  }
  const emailErr = optionalEmailFormatError(customerEmail)
  if (emailErr) errors.push(emailErr)
  if (!productId) errors.push('productId가 필요합니다.')
  if (!originSource) errors.push('originSource가 필요합니다.')
  if (!originCode) errors.push('originCode가 필요합니다.')

  if (adultCount < 0 || childCount < 0 || infantCount < 0) errors.push('인원 수는 0 이상이어야 합니다.')
  if (childWithBedCount < 0 || childNoBedCount < 0) errors.push('아동 베드/노베드 수는 0 이상이어야 합니다.')
  if (computedTotalPax <= 0) errors.push('총 인원은 1명 이상이어야 합니다.')
  if (adultCount + childCount + infantCount !== computedTotalPax) {
    errors.push('성인·아동·유아 합계가 맞지 않습니다.')
  }
  if (childWithBedCount + childNoBedCount !== childCount) {
    errors.push('아동(베드)+아동(노베드) 합이 아동 수와 같아야 합니다.')
  }

  if (!selectedDepartureDate && !preferredDepartureDate) {
    errors.push('선택 출발일 또는 희망 출발일 중 하나는 필수입니다.')
  }
  if (selectedDepartureDate && !isYmd(selectedDepartureDate)) errors.push('선택 출발일은 YYYY-MM-DD 형식이어야 합니다.')
  if (preferredDepartureDate && !isYmd(preferredDepartureDate)) errors.push('희망 출발일은 YYYY-MM-DD 형식이어야 합니다.')

  for (const row of childInfantBirthDates) {
    if (!isYmd(row.birthDate)) errors.push('생년월일은 YYYY-MM-DD 형식이어야 합니다.')
  }

  const childBirthRows = childInfantBirthDates.filter((x) => x.type === 'child')
  const infantBirthRows = childInfantBirthDates.filter((x) => x.type === 'infant')
  const needBirths = childCount + infantCount
  if (childInfantBirthDates.length !== needBirths) {
    errors.push(`아동·유아 생년월일은 ${needBirths}건이어야 합니다. (아동 ${childCount}명, 유아 ${infantCount}명)`)
  }
  if (childBirthRows.length !== childCount) {
    errors.push(`생년월일 항목 중 type=child인 개수는 아동 수(${childCount})와 같아야 합니다.`)
  }
  if (infantBirthRows.length !== infantCount) {
    errors.push(`생년월일 항목 중 type=infant인 개수는 유아 수(${infantCount})와 같아야 합니다.`)
  }

  if (errors.length > 0) return { ok: false, errors }
  return {
    ok: true,
    value: {
      productId,
      originSource,
      originCode,
      selectedDepartureDate,
      preferredDepartureDate,
      departureId,
      customerName,
      customerPhone,
      customerEmail: customerEmail.trim(),
      totalPax: computedTotalPax,
      adultCount,
      childCount,
      childWithBedCount,
      childNoBedCount,
      infantCount,
      singleRoomRequested,
      preferredContactChannel,
      childInfantBirthDates,
      requestNotes,
    },
  }
}

export function buildCustomerBookingReceiptMessage(name: string): string {
  const safeName = name.trim() || '고객님'
  return `${safeName}, 예약 요청이 정상 접수되었습니다. 담당자가 확인 후 연락드립니다. 실제 예약 가능 여부/결제/혜택은 확인 후 안내됩니다.`
}
